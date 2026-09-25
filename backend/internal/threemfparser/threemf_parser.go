package threemfparser

import (
	"archive/zip"
	"bufio"
	"compress/gzip"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// SlicerQualitySettings holds resolution & layer parameters
type SlicerQualitySettings struct {
	LayerHeight        string `json:"layer_height"`
	InitialLayerHeight string `json:"initial_layer_height"`
	LineWidth          string `json:"line_width"`
	SeamPosition       string `json:"seam_position"`
}

// SlicerStrengthSettings holds walls, shell and infill parameters
type SlicerStrengthSettings struct {
	WallLoops         string `json:"wall_loops"`
	TopShellLayers    string `json:"top_shell_layers"`
	BottomShellLayers string `json:"bottom_shell_layers"`
	InfillDensity     string `json:"infill_density"`
	InfillPattern     string `json:"infill_pattern"`
}

// SlicerSpeedSettings holds speed parameters in mm/s
type SlicerSpeedSettings struct {
	OuterWallSpeed    string `json:"outer_wall_speed"`
	InnerWallSpeed    string `json:"inner_wall_speed"`
	InfillSpeed       string `json:"infill_speed"`
	TravelSpeed       string `json:"travel_speed"`
	InitialLayerSpeed string `json:"initial_layer_speed"`
}

// SlicerSupportSettings holds overhang and tree support configuration
type SlicerSupportSettings struct {
	Enabled        bool   `json:"enabled"`
	SupportType    string `json:"support_type"`
	SupportStyle   string `json:"support_style"`
	ThresholdAngle string `json:"threshold_angle"`
}

// SlicerOtherSettings holds bed, nozzle and temperature parameters
type SlicerOtherSettings struct {
	BrimType          string `json:"brim_type"`
	NozzleTemperature string `json:"nozzle_temperature"`
	BedTemperature    string `json:"bed_temperature"`
	PrinterModel      string `json:"printer_model"`
	NozzleDiameter    string `json:"nozzle_diameter"`
}

// SlicerConfigDetails organizes the 5 fundamental slicer configuration tabs
type SlicerConfigDetails struct {
	Quality  SlicerQualitySettings  `json:"quality"`
	Strength SlicerStrengthSettings `json:"strength"`
	Speed    SlicerSpeedSettings    `json:"speed"`
	Support  SlicerSupportSettings  `json:"support"`
	Others   SlicerOtherSettings    `json:"others"`
}

// Parsed3MF holds technical 3D print data extracted from a sliced or raw .3mf package
type Parsed3MF struct {
	ProductWeightGrams float64             `json:"product_weight_grams"`
	SupportWeightGrams float64             `json:"support_weight_grams"`
	PrintMinutes       float64             `json:"print_minutes"`
	Dimensions         string              `json:"dimensions"`
	DimXMm             float64             `json:"dim_x_mm"`
	DimYMm             float64             `json:"dim_y_mm"`
	DimZMm             float64             `json:"dim_z_mm"`
	Material           string              `json:"material"`
	LayerHeight        string              `json:"layer_height"`
	InfillPercent      int                 `json:"infill_percent"`
	SlicerDetected     string              `json:"slicer_detected"`
	FileName           string              `json:"file_name"`
	ThumbnailBase64    string              `json:"thumbnail_base64,omitempty"`
	Settings           SlicerConfigDetails `json:"settings"`
	RawSettingsJSON    string              `json:"raw_settings_json,omitempty"`
}

// Parse3MF reads a .3mf zip archive and extracts slicer metadata and 3D dimensions
func Parse3MF(reader io.ReaderAt, size int64, fileName string) (*Parsed3MF, error) {
	zr, err := zip.NewReader(reader, size)
	if err != nil {
		return nil, fmt.Errorf("erro ao abrir arquivo .3mf (não é um arquivo zip/3mf válido): %w", err)
	}

	result := &Parsed3MF{
		FileName: fileName,
	}

	bounds := &modelBounds{
		minX: math.MaxFloat64, maxX: -math.MaxFloat64,
		minY: math.MaxFloat64, maxY: -math.MaxFloat64,
		minZ: math.MaxFloat64, maxZ: -math.MaxFloat64,
	}

	// 1. Scan files in archive
	for _, f := range zr.File {
		nameLower := strings.ToLower(f.Name)

		// Bambu Studio / OrcaSlicer / PrusaSlicer config files & metadata
		if strings.HasSuffix(nameLower, ".config") ||
			strings.HasSuffix(nameLower, ".json") ||
			(strings.Contains(nameLower, "metadata/") && strings.HasSuffix(nameLower, ".xml")) {
			rc, err := f.Open()
			if err == nil {
				if strings.Contains(nameLower, "prusaslicer") || strings.Contains(nameLower, "slic3r") {
					parsePrusaConfig(rc, result)
				} else {
					parseBambuConfigFile(rc, result)
				}
				rc.Close()
			}
		}

		// Embedded plate gcodes (.gcode or .gcode.gz)
		if strings.HasSuffix(nameLower, ".gcode") || strings.HasSuffix(nameLower, ".gcode.gz") {
			rc, err := f.Open()
			if err == nil {
				var r io.Reader = rc
				if strings.HasSuffix(nameLower, ".gz") {
					gzr, gzErr := gzip.NewReader(rc)
					if gzErr == nil {
						defer gzr.Close()
						r = gzr
					}
				}
				parseGcodeComments(r, result)
				rc.Close()
			}
		}

		// 3D Model XML geometry for bounding box dimensions and mesh volume (any .model file in package)
		if strings.HasSuffix(nameLower, ".model") {
			rc, err := f.Open()
			if err == nil {
				parseModelDimensions(rc, bounds)
				rc.Close()
			}
		}

		// Embedded sliced plate thumbnail (Bambu/Orca plate_1.png or Prusa thumbnail.png)
		if (strings.HasSuffix(nameLower, ".png") || strings.HasSuffix(nameLower, ".jpg") || strings.HasSuffix(nameLower, ".jpeg")) &&
			(strings.Contains(nameLower, "plate_") || strings.Contains(nameLower, "thumbnail") || strings.Contains(nameLower, "top_file")) {
			if result.ThumbnailBase64 == "" || strings.Contains(nameLower, "plate_1.png") || strings.Contains(nameLower, "thumbnail.png") {
				rc, err := f.Open()
				if err == nil {
					data, err := io.ReadAll(rc)
					rc.Close()
					if err == nil && len(data) > 0 {
						mime := "image/png"
						if strings.HasSuffix(nameLower, ".jpg") || strings.HasSuffix(nameLower, ".jpeg") {
							mime = "image/jpeg"
						}
						result.ThumbnailBase64 = fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data))
					}
				}
			}
		}
	}

	// Format dimensions string if geometry vertices were found
	if bounds.hasVertices {
		result.DimXMm = math.Round((bounds.maxX-bounds.minX)*10) / 10
		result.DimYMm = math.Round((bounds.maxY-bounds.minY)*10) / 10
		result.DimZMm = math.Round((bounds.maxZ-bounds.minZ)*10) / 10
		result.Dimensions = fmt.Sprintf("%.1f x %.1f x %.1f mm", result.DimXMm, result.DimYMm, result.DimZMm)
	}

	// Fill high-level layer height and infill if extracted in detailed settings
	if result.LayerHeight == "" && result.Settings.Quality.LayerHeight != "" {
		result.LayerHeight = result.Settings.Quality.LayerHeight
	}
	if result.Settings.Strength.InfillDensity != "" && result.InfillPercent == 0 {
		cleaned := strings.TrimSuffix(result.Settings.Strength.InfillDensity, "%")
		if val, err := strconv.Atoi(cleaned); err == nil {
			result.InfillPercent = val
		}
	}

	// Fallback calculation for Weight & Print Time if missing from slicer metadata (e.g. raw 3MF model)
	if result.ProductWeightGrams <= 0 || result.PrintMinutes <= 0 {
		var estWeightG float64
		var estMinutes float64

		density := 1.24 // PLA standard density (g/cm³)
		if strings.Contains(strings.ToUpper(result.Material), "PETG") {
			density = 1.27
		} else if strings.Contains(strings.ToUpper(result.Material), "ABS") {
			density = 1.04
		} else if strings.Contains(strings.ToUpper(result.Material), "TPU") {
			density = 1.21
		}

		infillPercent := 20
		if result.InfillPercent > 0 {
			infillPercent = result.InfillPercent
		}
		infillRatio := float64(infillPercent) / 100.0
		shellRatio := 0.20
		effectiveVolRatio := shellRatio + (1.0-shellRatio)*infillRatio

		if bounds.volumeCm3 > 0.05 {
			effectiveVolCm3 := bounds.volumeCm3 * effectiveVolRatio
			estWeightG = math.Max(5.0, math.Round(effectiveVolCm3*density*10)/10)
			hours := math.Max(0.5, math.Round((estWeightG/18.0)*10)/10) // ~18g/hour standard printing rate
			estMinutes = math.Round(hours * 60)
		} else if bounds.hasVertices && result.DimXMm > 0 && result.DimYMm > 0 && result.DimZMm > 0 {
			bboxVolCm3 := (result.DimXMm * result.DimYMm * result.DimZMm) / 1000.0
			// Average occupancy of bounding box for decorative/functional 3D prints is ~20%
			effectiveVolCm3 := bboxVolCm3 * 0.20 * effectiveVolRatio
			estWeightG = math.Max(10.0, math.Round(effectiveVolCm3*density*10)/10)
			hours := math.Max(0.5, math.Round((estWeightG/18.0)*10)/10)
			estMinutes = math.Round(hours * 60)
		}

		if result.ProductWeightGrams <= 0 && estWeightG > 0 {
			result.ProductWeightGrams = estWeightG
		}
		if result.PrintMinutes <= 0 && estMinutes > 0 {
			result.PrintMinutes = estMinutes
		}
	}

	// Default fallback material if none detected
	if result.Material == "" {
		result.Material = "PLA"
	}
	if result.LayerHeight == "" {
		result.LayerHeight = "0.20mm"
	}

	// Serialize settings to JSON string for database storage
	if b, err := json.Marshal(result.Settings); err == nil {
		result.RawSettingsJSON = string(b)
	}

	return result, nil
}

// cleanMaterialName normalizes extracted filament material strings
func cleanMaterialName(val string) string {
	val = strings.Trim(val, `"' `)
	if strings.Contains(val, ";") || strings.Contains(val, ",") {
		parts := strings.FieldsFunc(val, func(r rune) bool {
			return r == ';' || r == ','
		})
		unique := make([]string, 0)
		seen := make(map[string]bool)
		for _, p := range parts {
			trimmed := strings.Trim(p, `"' `)
			if trimmed != "" && !seen[strings.ToLower(trimmed)] && isValidFilamentMaterial(trimmed) {
				seen[strings.ToLower(trimmed)] = true
				unique = append(unique, trimmed)
			}
		}
		if len(unique) > 0 {
			return strings.Join(unique, ", ")
		}
	}
	return val
}

// isValidFilamentMaterial filters out structural part types like "normal_part"
func isValidFilamentMaterial(val string) bool {
	if val == "" {
		return false
	}
	lower := strings.ToLower(val)
	invalidWords := []string{
		"normal_part", "modifier", "negative_volume", "model", "part",
		"volume", "true", "false", "null", "none", "undefined", "auto", "default",
	}
	for _, inv := range invalidWords {
		if lower == inv || strings.HasPrefix(lower, inv) {
			return false
		}
	}
	return true
}

// parseBambuConfigFile parses Bambu / OrcaSlicer project settings & XML
func parseBambuConfigFile(r io.Reader, out *Parsed3MF) {
	data, err := io.ReadAll(r)
	if err != nil {
		return
	}

	content := string(data)
	if out.SlicerDetected == "" {
		out.SlicerDetected = "Bambu Studio / OrcaSlicer"
	}

	// 1. Prediction / estimated time
	if out.PrintMinutes == 0 {
		// Look for XML tags: <prediction>, <estimated_time>, <print_time>, <total_time>
		reTag := regexp.MustCompile(`(?i)<(?:prediction|estimated_time|print_time|total_time)>\s*([^<]+)\s*</(?:prediction|estimated_time|print_time|total_time)>`)
		if matches := reTag.FindAllStringSubmatch(content, -1); len(matches) > 0 {
			var totalMin float64
			for _, m := range matches {
				totalMin += parseTimeToMinutes(m[1])
			}
			if totalMin > 0 {
				out.PrintMinutes = totalMin
			}
		}

		// Look for metadata attributes: key="prediction" value="..."
		if out.PrintMinutes == 0 {
			reMeta := regexp.MustCompile(`(?i)<metadata\s+[^>]*key=["'](?:prediction|estimated_time|print_time|total_time)["']\s+value=["']([^"']+)["']`)
			if matches := reMeta.FindAllStringSubmatch(content, -1); len(matches) > 0 {
				var totalMin float64
				for _, m := range matches {
					totalMin += parseTimeToMinutes(m[1])
				}
				if totalMin > 0 {
					out.PrintMinutes = totalMin
				}
			}
		}

		// Look for key-value or JSON: "prediction": 12345 or "prediction": "2h 30m"
		if out.PrintMinutes == 0 {
			reKV := regexp.MustCompile(`(?i)["'](?:prediction|estimated_time|print_time|total_time)["']\s*[:=]\s*["']?([^"',\r\n\]\}]+)["']?`)
			if match := reKV.FindStringSubmatch(content); len(match) > 1 {
				if min := parseTimeToMinutes(match[1]); min > 0 {
					out.PrintMinutes = min
				}
			}
		}
	}

	// 2. Weight (in grams)
	if out.ProductWeightGrams == 0 {
		// Look for explicit XML tags: <weight>84.84</weight>
		reWeightTag := regexp.MustCompile(`(?i)<(?:weight|total_weight|filament_weight)>\s*([0-9.]+)\s*</(?:weight|total_weight|filament_weight)>`)
		if matches := reWeightTag.FindAllStringSubmatch(content, -1); len(matches) > 0 {
			var sumW float64
			for _, m := range matches {
				if w, err := strconv.ParseFloat(m[1], 64); err == nil && w > 0 {
					sumW += w
				}
			}
			if sumW > 0 {
				out.ProductWeightGrams = math.Round(sumW*100) / 100
			}
		}

		// Look for metadata tags: key="weight" value="..."
		if out.ProductWeightGrams == 0 {
			reMetaWeight := regexp.MustCompile(`(?i)<metadata\s+[^>]*key=["'](?:weight|filament_used_g|used_g|total_weight)["']\s+value=["']([0-9.]+)["']`)
			if matches := reMetaWeight.FindAllStringSubmatch(content, -1); len(matches) > 0 {
				var sumW float64
				for _, m := range matches {
					if w, err := strconv.ParseFloat(m[1], 64); err == nil && w > 0 {
						sumW += w
					}
				}
				if sumW > 0 {
					out.ProductWeightGrams = math.Round(sumW*100) / 100
				}
			}
		}

		// Sum all used_g attributes in <filament ... used_g="..." />
		if out.ProductWeightGrams == 0 {
			reUsedG := regexp.MustCompile(`(?i)used_g=["']([0-9.]+)["']`)
			if matches := reUsedG.FindAllStringSubmatch(content, -1); len(matches) > 0 {
				var sumW float64
				for _, m := range matches {
					if w, err := strconv.ParseFloat(m[1], 64); err == nil && w > 0 {
						sumW += w
					}
				}
				if sumW > 0 {
					out.ProductWeightGrams = math.Round(sumW*100) / 100
				}
			}
		}

		// Sum all used_m (filament meters) in <filament ... used_m="..." />
		if out.ProductWeightGrams == 0 {
			reUsedM := regexp.MustCompile(`(?i)used_m=["']([0-9.]+)["']`)
			if matches := reUsedM.FindAllStringSubmatch(content, -1); len(matches) > 0 {
				var sumM float64
				for _, m := range matches {
					if l, err := strconv.ParseFloat(m[1], 64); err == nil && l > 0 {
						sumM += l
					}
				}
				if sumM > 0 {
					// 1.75mm PLA filament is ~2.98g per meter
					out.ProductWeightGrams = math.Round(sumM*2.98*100) / 100
				}
			}
		}

		// JSON or key-value fields: "filament_used_g": 84.84 or "weight": 84.84
		if out.ProductWeightGrams == 0 {
			reKVWeight := regexp.MustCompile(`(?i)["'](?:weight|filament_used_g|used_g|total_weight|filament_weight)["']\s*[:=]\s*["']?([0-9.]+)["']?`)
			if match := reKVWeight.FindStringSubmatch(content); len(match) > 1 {
				if w, err := strconv.ParseFloat(match[1], 64); err == nil && w > 0 {
					out.ProductWeightGrams = math.Round(w*100) / 100
				}
			}
		}
	}

	// 3. Material (strictly filament type, ignoring normal_part and other object types)
	if out.Material == "" {
		reFilamentType := []*regexp.Regexp{
			regexp.MustCompile(`(?i)<filament\s+[^>]*type=["']([A-Za-z0-9_\-+ ]+)["']`),
			regexp.MustCompile(`(?i)<filament_type>([A-Za-z0-9_\-+ ]+)</filament_type>`),
			regexp.MustCompile(`(?i)<metadata\s+[^>]*key=["']filament_types?["']\s+value=["']([^"']+)["']`),
			regexp.MustCompile(`(?i)["']filament_types?["']\s*:\s*(?:\[\s*["']?([^"',\]]+)["']?|["']?([^"',\r\n\]]+)["']?)`),
			regexp.MustCompile(`(?i)filament_types?\s*=\s*([^\r\n]+)`),
		}

		for _, re := range reFilamentType {
			if match := re.FindStringSubmatch(content); len(match) > 1 {
				val := strings.TrimSpace(match[1])
				if val == "" && len(match) > 2 {
					val = strings.TrimSpace(match[2])
				}
				val = cleanMaterialName(val)
				if isValidFilamentMaterial(val) {
					out.Material = val
					break
				}
			}
		}
	}

	// Try extracting key-values (JSON or config syntax)
	extractKeyValueSettings(content, out)
}

// extractKeyValueSettings parses settings formatted either as JSON or as key = value lines
func extractKeyValueSettings(content string, out *Parsed3MF) {
	// First try JSON map
	var rawMap map[string]interface{}
	if err := json.Unmarshal([]byte(content), &rawMap); err == nil {
		applyMapSettings(rawMap, out)
		return
	}

	// Fallback regex scanner for key-value pairs
	// Matches: "key": "value", "key": value or key = value
	reKV := regexp.MustCompile(`(?i)["']?([a-zA-Z0-9_]+)["']?\s*[:=]\s*["']?([^"',\r\n\]\}]+)["']?`)
	matches := reKV.FindAllStringSubmatch(content, -1)
	m := make(map[string]interface{})
	for _, match := range matches {
		if len(match) > 2 {
			m[strings.TrimSpace(match[1])] = strings.TrimSpace(match[2])
		}
	}
	applyMapSettings(m, out)
}

func applyMapSettings(m map[string]interface{}, out *Parsed3MF) {
	getStr := func(keys ...string) string {
		for _, k := range keys {
			if v, ok := m[k]; ok && v != nil {
				str := strings.TrimSpace(fmt.Sprintf("%v", v))
				if str != "" && str != "<nil>" {
					return str
				}
			}
		}
		return ""
	}

	// Quality
	if v := getStr("layer_height", "layerHeight"); v != "" {
		out.Settings.Quality.LayerHeight = formatMm(v)
		if out.LayerHeight == "" {
			out.LayerHeight = out.Settings.Quality.LayerHeight
		}
	}
	if v := getStr("initial_layer_print_height", "initial_layer_height", "first_layer_height"); v != "" {
		out.Settings.Quality.InitialLayerHeight = formatMm(v)
	}
	if v := getStr("line_width", "default_line_width", "extrusion_width"); v != "" {
		out.Settings.Quality.LineWidth = formatMm(v)
	}
	if v := getStr("seam_position"); v != "" {
		out.Settings.Quality.SeamPosition = v
	}

	// Strength
	if v := getStr("wall_loops", "perimeters", "walls"); v != "" {
		out.Settings.Strength.WallLoops = v
	}
	if v := getStr("top_shell_layers", "top_solid_layers"); v != "" {
		out.Settings.Strength.TopShellLayers = v
	}
	if v := getStr("bottom_shell_layers", "bottom_solid_layers"); v != "" {
		out.Settings.Strength.BottomShellLayers = v
	}
	if v := getStr("sparse_infill_density", "fill_density", "infill_density"); v != "" {
		if !strings.HasSuffix(v, "%") {
			if num, err := strconv.ParseFloat(v, 64); err == nil && num <= 1.0 {
				v = fmt.Sprintf("%d%%", int(num*100))
			} else {
				v = v + "%"
			}
		}
		out.Settings.Strength.InfillDensity = v
	}
	if v := getStr("sparse_infill_pattern", "fill_pattern", "infill_pattern"); v != "" {
		out.Settings.Strength.InfillPattern = strings.Title(strings.ToLower(v))
	}

	// Speed
	if v := getStr("outer_wall_speed", "perimeter_speed"); v != "" {
		out.Settings.Speed.OuterWallSpeed = formatSpeed(v)
	}
	if v := getStr("inner_wall_speed"); v != "" {
		out.Settings.Speed.InnerWallSpeed = formatSpeed(v)
	}
	if v := getStr("sparse_infill_speed", "infill_speed"); v != "" {
		out.Settings.Speed.InfillSpeed = formatSpeed(v)
	}
	if v := getStr("travel_speed"); v != "" {
		out.Settings.Speed.TravelSpeed = formatSpeed(v)
	}
	if v := getStr("initial_layer_speed", "first_layer_speed"); v != "" {
		out.Settings.Speed.InitialLayerSpeed = formatSpeed(v)
	}

	// Support
	if v := getStr("enable_support", "support_material"); v != "" {
		out.Settings.Support.Enabled = (v == "1" || strings.ToLower(v) == "true" || strings.ToLower(v) == "on")
	}
	if v := getStr("support_type"); v != "" {
		out.Settings.Support.SupportType = strings.Title(strings.ToLower(v))
	}
	if v := getStr("support_style", "support_material_style"); v != "" {
		out.Settings.Support.SupportStyle = strings.Title(strings.ToLower(strings.ReplaceAll(v, "_", " ")))
	}
	if v := getStr("support_threshold_angle"); v != "" {
		out.Settings.Support.ThresholdAngle = v + "°"
	}

	// Others
	if v := getStr("brim_type"); v != "" {
		out.Settings.Others.BrimType = strings.Title(strings.ToLower(strings.ReplaceAll(v, "_", " ")))
	}
	if v := getStr("nozzle_temperature", "temperature"); v != "" {
		out.Settings.Others.NozzleTemperature = v + " °C"
	}
	if v := getStr("bed_temperature", "hot_plate_temp"); v != "" {
		out.Settings.Others.BedTemperature = v + " °C"
	}
	if v := getStr("printer_model", "printer_preset"); v != "" {
		out.Settings.Others.PrinterModel = v
	}
	if v := getStr("nozzle_diameter"); v != "" {
		out.Settings.Others.NozzleDiameter = formatMm(v)
	}
}

func formatMm(val string) string {
	val = strings.TrimSpace(val)
	if !strings.HasSuffix(val, "mm") {
		return val + "mm"
	}
	return val
}

func formatSpeed(val string) string {
	val = strings.TrimSpace(val)
	if !strings.HasSuffix(val, "mm/s") {
		return val + " mm/s"
	}
	return val
}

// parsePrusaConfig parses PrusaSlicer key-value config
func parsePrusaConfig(r io.Reader, out *Parsed3MF) {
	scanner := bufio.NewScanner(r)
	if out.SlicerDetected == "" {
		out.SlicerDetected = "PrusaSlicer"
	}

	contentBuilder := strings.Builder{}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		contentBuilder.WriteString(line + "\n")

		// filament used [g] = 84.84 or filament_used_g = 84.84
		lineLower := strings.ToLower(line)
		if strings.Contains(lineLower, "filament used") || strings.Contains(lineLower, "filament_used") {
			parts := strings.Split(line, "=")
			if len(parts) >= 2 {
				valStr := strings.TrimSpace(parts[1])
				valStr = strings.TrimSuffix(valStr, "g")
				valStr = strings.TrimSpace(valStr)
				if val, err := strconv.ParseFloat(valStr, 64); err == nil && val > 0 && out.ProductWeightGrams == 0 {
					out.ProductWeightGrams = math.Round(val*100) / 100
				}
			}
		}

		// estimated printing time = 5h 38m 12s
		if strings.Contains(lineLower, "estimated") && strings.Contains(lineLower, "time") {
			parts := strings.Split(line, "=")
			if len(parts) >= 2 {
				min := parseTimeToMinutes(strings.TrimSpace(parts[1]))
				if min > 0 && out.PrintMinutes == 0 {
					out.PrintMinutes = min
				}
			}
		}
	}

	extractKeyValueSettings(contentBuilder.String(), out)
}

// parseGcodeComments inspects embedded gcode comments for slicing stats
func parseGcodeComments(r io.Reader, out *Parsed3MF) {
	scanner := bufio.NewScanner(r)
	buf := make([]byte, 1024*1024)
	scanner.Buffer(buf, 1024*1024)
	lineCount := 0

	for scanner.Scan() {
		lineCount++
		// If both stats found, can safely exit early
		if out.ProductWeightGrams > 0 && out.PrintMinutes > 0 {
			break
		}
		if lineCount > 2000 && (out.ProductWeightGrams > 0 || out.PrintMinutes > 0) {
			break
		}

		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, ";") {
			continue
		}

		lineLower := strings.ToLower(line)

		// Print time comments
		if out.PrintMinutes == 0 && (strings.Contains(lineLower, "time") || strings.Contains(lineLower, "duration")) {
			if strings.Contains(lineLower, "printing time") ||
				strings.Contains(lineLower, "estimated time") ||
				strings.Contains(lineLower, "model time") ||
				strings.Contains(lineLower, "total estimated time") {
				parts := strings.Split(line, ":")
				if len(parts) >= 2 {
					timePart := strings.TrimSpace(strings.Join(parts[1:], ":"))
					if min := parseTimeToMinutes(timePart); min > 0 {
						out.PrintMinutes = min
					}
				}
				if out.PrintMinutes == 0 {
					partsEq := strings.Split(line, "=")
					if len(partsEq) >= 2 {
						timePart := strings.TrimSpace(partsEq[1])
						if min := parseTimeToMinutes(timePart); min > 0 {
							out.PrintMinutes = min
						}
					}
				}
			}
		}

		// Filament weight comments
		if out.ProductWeightGrams == 0 && strings.Contains(lineLower, "filament") {
			reW := regexp.MustCompile(`(?i)(?:filament\s+used|used\s+filament|total\s+filament)[^=:]*[=:]\s*([0-9.]+)`)
			if m := reW.FindStringSubmatch(line); len(m) > 1 {
				if w, err := strconv.ParseFloat(m[1], 64); err == nil && w > 0 {
					out.ProductWeightGrams = math.Round(w*100) / 100
				}
			}
			if out.ProductWeightGrams == 0 {
				reGram := regexp.MustCompile(`([0-9]+(?:\.[0-9]+)?)\s*g\b`)
				if m := reGram.FindStringSubmatch(line); len(m) > 1 {
					if w, err := strconv.ParseFloat(m[1], 64); err == nil && w > 0 {
						out.ProductWeightGrams = math.Round(w*100) / 100
					}
				}
			}
		}
	}
}

// parseTimeToMinutes parses strings like "5h 38m 12s", "5h 38m", "338m", "05:38:12", "20280s" or "20280"
func parseTimeToMinutes(raw string) float64 {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return 0
	}

	// 1. Clock format: "05:38:12" or "02:15"
	reClock := regexp.MustCompile(`^(\d{1,2}):(\d{2})(?::(\d{2}))?$`)
	if m := reClock.FindStringSubmatch(raw); len(m) > 1 {
		h, _ := strconv.ParseFloat(m[1], 64)
		min, _ := strconv.ParseFloat(m[2], 64)
		sec := 0.0
		if len(m) > 3 && m[3] != "" {
			sec, _ = strconv.ParseFloat(m[3], 64)
		}
		return h*60.0 + min + math.Round(sec/60.0)
	}

	// 2. Units format: combines hours, minutes, and seconds (e.g. "5h 38m 12s", "3h 15m", "45min")
	reH := regexp.MustCompile(`([0-9.]+)\s*h(?:our|ours|r)?\b`)
	reM := regexp.MustCompile(`([0-9.]+)\s*m(?:in|ins|inute|inutes)?\b`)
	reS := regexp.MustCompile(`([0-9.]+)\s*s(?:ec|ecs|econd|econds)?\b`)

	var hours, mins, secs float64
	hasUnit := false

	if m := reH.FindStringSubmatch(raw); len(m) > 1 {
		hours, _ = strconv.ParseFloat(m[1], 64)
		hasUnit = true
	}
	if m := reM.FindStringSubmatch(raw); len(m) > 1 {
		mins, _ = strconv.ParseFloat(m[1], 64)
		hasUnit = true
	}
	if m := reS.FindStringSubmatch(raw); len(m) > 1 {
		secs, _ = strconv.ParseFloat(m[1], 64)
		hasUnit = true
	}

	if hasUnit {
		total := hours*60.0 + mins + math.Round(secs/60.0)
		if total > 0 {
			return total
		}
	}

	// 3. Raw number (e.g. "20280" seconds from Bambu Studio <prediction>20280</prediction>)
	reNum := regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)$`)
	if m := reNum.FindStringSubmatch(raw); len(m) > 1 {
		num, _ := strconv.ParseFloat(m[1], 64)
		if num > 300 { // Large number represents seconds
			return math.Round(num / 60.0)
		}
		if num > 0 { // Small number represents minutes
			return math.Round(num)
		}
	}

	return 0
}

type modelPoint3D struct {
	X, Y, Z float64
}

type modelBounds struct {
	minX, maxX    float64
	minY, maxY    float64
	minZ, maxZ    float64
	hasVertices   bool
	vertices      []modelPoint3D
	volumeCm3     float64
	triangleCount int
}

// parseModelDimensions reads standard 3MF XML (3D/3dmodel.model or 3D/Objects/*.model) vertices & triangles
func parseModelDimensions(r io.Reader, bounds *modelBounds) {
	decoder := xml.NewDecoder(r)
	scale := 1.0
	var totalSignedVolume float64

	for {
		tok, err := decoder.Token()
		if err != nil {
			break
		}

		if se, ok := tok.(xml.StartElement); ok {
			// Check units in <model unit="millimeter">
			if strings.EqualFold(se.Name.Local, "model") {
				for _, attr := range se.Attr {
					if strings.EqualFold(attr.Name.Local, "unit") {
						switch strings.ToLower(attr.Value) {
						case "micron":
							scale = 0.001
						case "millimeter":
							scale = 1.0
						case "centimeter":
							scale = 10.0
						case "inch":
							scale = 25.4
						}
					}
				}
			}

			if strings.EqualFold(se.Name.Local, "vertex") {
				var vx, vy, vz float64
				foundX, foundY, foundZ := false, false, false

				for _, attr := range se.Attr {
					switch strings.ToLower(attr.Name.Local) {
					case "x":
						vx, _ = strconv.ParseFloat(attr.Value, 64)
						foundX = true
					case "y":
						vy, _ = strconv.ParseFloat(attr.Value, 64)
						foundY = true
					case "z":
						vz, _ = strconv.ParseFloat(attr.Value, 64)
						foundZ = true
					}
				}

				if foundX && foundY && foundZ {
					vx *= scale
					vy *= scale
					vz *= scale

					bounds.hasVertices = true
					if vx < bounds.minX {
						bounds.minX = vx
					}
					if vx > bounds.maxX {
						bounds.maxX = vx
					}
					if vy < bounds.minY {
						bounds.minY = vy
					}
					if vy > bounds.maxY {
						bounds.maxY = vy
					}
					if vz < bounds.minZ {
						bounds.minZ = vz
					}
					if vz > bounds.maxZ {
						bounds.maxZ = vz
					}

					bounds.vertices = append(bounds.vertices, modelPoint3D{X: vx, Y: vy, Z: vz})
				}
			}

			if strings.EqualFold(se.Name.Local, "triangle") {
				var v1, v2, v3 int = -1, -1, -1
				for _, attr := range se.Attr {
					switch strings.ToLower(attr.Name.Local) {
					case "v1":
						v1, _ = strconv.Atoi(attr.Value)
					case "v2":
						v2, _ = strconv.Atoi(attr.Value)
					case "v3":
						v3, _ = strconv.Atoi(attr.Value)
					}
				}
				numV := len(bounds.vertices)
				if v1 >= 0 && v1 < numV && v2 >= 0 && v2 < numV && v3 >= 0 && v3 < numV {
					p1 := bounds.vertices[v1]
					p2 := bounds.vertices[v2]
					p3 := bounds.vertices[v3]

					// Signed tetrahedron volume calculation
					vSigned := (-p3.X*p2.Y*p1.Z + p2.X*p3.Y*p1.Z + p3.X*p1.Y*p2.Z - p1.X*p3.Y*p2.Z - p2.X*p1.Y*p3.Z + p1.X*p2.Y*p3.Z) / 6.0
					totalSignedVolume += vSigned
					bounds.triangleCount++
				}
			}
		}
	}

	volMm3 := math.Abs(totalSignedVolume)
	bounds.volumeCm3 += volMm3 / 1000.0
}
