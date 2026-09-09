package stlparser

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
)

type Point3D struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type Triangle struct {
	Normal   Point3D `json:"normal"`
	V1       Point3D `json:"v1"`
	V2       Point3D `json:"v2"`
	V3       Point3D `json:"v3"`
}

type MeshAnalysis struct {
	TriangleCount  int     `json:"triangle_count"`
	VolumeCm3      float64 `json:"volume_cm3"`
	SurfaceAreaCm2 float64 `json:"surface_area_cm2"`
	DimXMm         float64 `json:"dim_x_mm"`
	DimYMm         float64 `json:"dim_y_mm"`
	DimZMm         float64 `json:"dim_z_mm"`
}

type SliceResult struct {
	Mesh              MeshAnalysis `json:"mesh"`
	MaterialType      string       `json:"material_type"`
	InfillPercent     int          `json:"infill_percent"`
	EstimatedWeightG  float64      `json:"estimated_weight_g"`
	EstimatedHours    float64      `json:"estimated_hours"`
	EstimatedPrice    float64      `json:"estimated_price"`
}

// Material densities in g/cm3
var materialDensities = map[string]float64{
	"PLA":   1.24,
	"ABS":   1.04,
	"PETG":  1.27,
	"TPU":   1.21,
	"Resin": 1.15,
}

// ParseSTL auto-detects binary or ASCII STL data and computes mesh volume, dimensions, and area
func ParseSTL(reader io.Reader) (MeshAnalysis, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return MeshAnalysis{}, fmt.Errorf("erro ao ler arquivo STL: %w", err)
	}

	if len(data) < 84 {
		return MeshAnalysis{}, errors.New("tamanho de arquivo STL inválido ou corrompido")
	}

	// Check if ASCII STL format
	headerPrefix := strings.ToLower(string(data[:80]))
	if strings.HasPrefix(strings.TrimSpace(headerPrefix), "solid") && !isBinarySTL(data) {
		return parseASCIISTL(data)
	}

	return parseBinarySTL(data)
}

func isBinarySTL(data []byte) bool {
	if len(data) < 84 {
		return false
	}
	expectedNumTriangles := binary.LittleEndian.Uint32(data[80:84])
	expectedSize := 84 + (expectedNumTriangles * 50)
	return uint64(len(data)) == uint64(expectedSize)
}

func parseBinarySTL(data []byte) (MeshAnalysis, error) {
	if len(data) < 84 {
		return MeshAnalysis{}, errors.New("tamanho insuficiente para STL binário")
	}

	numTriangles := binary.LittleEndian.Uint32(data[80:84])
	if numTriangles == 0 {
		return MeshAnalysis{}, errors.New("arquivo STL não contém triângulos")
	}

	var totalSignedVolume float64
	var totalArea float64

	minX, maxX := math.MaxFloat64, -math.MaxFloat64
	minY, maxY := math.MaxFloat64, -math.MaxFloat64
	minZ, maxZ := math.MaxFloat64, -math.MaxFloat64

	offset := 84
	dataLen := len(data)

	for i := 0; i < int(numTriangles); i++ {
		if offset+50 > dataLen {
			break
		}

		v1 := readPoint(data[offset+12 : offset+24])
		v2 := readPoint(data[offset+24 : offset+36])
		v3 := readPoint(data[offset+36 : offset+48])
		offset += 50

		// Update bounding box
		minX = math.Min(minX, math.Min(v1.X, math.Min(v2.X, v3.X)))
		maxX = math.Max(maxX, math.Max(v1.X, math.Max(v2.X, v3.X)))

		minY = math.Min(minY, math.Min(v1.Y, math.Min(v2.Y, v3.Y)))
		maxY = math.Max(maxY, math.Max(v1.Y, math.Max(v2.Y, v3.Y)))

		minZ = math.Min(minZ, math.Min(v1.Z, math.Min(v2.Z, v3.Z)))
		maxZ = math.Max(maxZ, math.Max(v1.Z, math.Max(v2.Z, v3.Z)))

		// Signed tetrahedron volume calculation
		vSigned := (-v3.X*v2.Y*v1.Z + v2.X*v3.Y*v1.Z + v3.X*v1.Y*v2.Z - v1.X*v3.Y*v2.Z - v2.X*v1.Y*v3.Z + v1.X*v2.Y*v3.Z) / 6.0
		totalSignedVolume += vSigned

		// Surface area calculation
		area := calculateTriangleArea(v1, v2, v3)
		totalArea += area
	}

	volMm3 := math.Abs(totalSignedVolume)
	volCm3 := volMm3 / 1000.0
	areaCm2 := totalArea / 100.0

	dimX := math.Max(0, maxX-minX)
	dimY := math.Max(0, maxY-minY)
	dimZ := math.Max(0, maxZ-minZ)

	return MeshAnalysis{
		TriangleCount:  int(numTriangles),
		VolumeCm3:      math.Round(volCm3*100) / 100,
		SurfaceAreaCm2: math.Round(areaCm2*100) / 100,
		DimXMm:         math.Round(dimX*10) / 10,
		DimYMm:         math.Round(dimY*10) / 10,
		DimZMm:         math.Round(dimZ*10) / 10,
	}, nil
}

func parseASCIISTL(data []byte) (MeshAnalysis, error) {
	lines := strings.Split(string(data), "\n")
	var vertices []Point3D
	var totalSignedVolume float64
	var totalArea float64
	triCount := 0

	minX, maxX := math.MaxFloat64, -math.MaxFloat64
	minY, maxY := math.MaxFloat64, -math.MaxFloat64
	minZ, maxZ := math.MaxFloat64, -math.MaxFloat64

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "vertex ") {
			var p Point3D
			_, err := fmt.Sscanf(line, "vertex %f %f %f", &p.X, &p.Y, &p.Z)
			if err == nil {
				vertices = append(vertices, p)
				minX = math.Min(minX, p.X)
				maxX = math.Max(maxX, p.X)
				minY = math.Min(minY, p.Y)
				maxY = math.Max(maxY, p.Y)
				minZ = math.Min(minZ, p.Z)
				maxZ = math.Max(maxZ, p.Z)

				if len(vertices) == 3 {
					v1, v2, v3 := vertices[0], vertices[1], vertices[2]
					vSigned := (-v3.X*v2.Y*v1.Z + v2.X*v3.Y*v1.Z + v3.X*v1.Y*v2.Z - v1.X*v3.Y*v2.Z - v2.X*v1.Y*v3.Z + v1.X*v2.Y*v3.Z) / 6.0
					totalSignedVolume += vSigned
					totalArea += calculateTriangleArea(v1, v2, v3)
					triCount++
					vertices = vertices[:0]
				}
			}
		}
	}

	if triCount == 0 {
		return MeshAnalysis{}, errors.New("nenhum vértice válido encontrado no arquivo ASCII STL")
	}

	volCm3 := math.Abs(totalSignedVolume) / 1000.0
	areaCm2 := totalArea / 100.0

	return MeshAnalysis{
		TriangleCount:  triCount,
		VolumeCm3:      math.Round(volCm3*100) / 100,
		SurfaceAreaCm2: math.Round(areaCm2*100) / 100,
		DimXMm:         math.Round(math.Max(0, maxX-minX)*10) / 10,
		DimYMm:         math.Round(math.Max(0, maxY-minY)*10) / 10,
		DimZMm:         math.Round(math.Max(0, maxZ-minZ)*10) / 10,
	}, nil
}

func readPoint(b []byte) Point3D {
	return Point3D{
		X: float64(math.Float32frombits(binary.LittleEndian.Uint32(b[0:4]))),
		Y: float64(math.Float32frombits(binary.LittleEndian.Uint32(b[4:8]))),
		Z: float64(math.Float32frombits(binary.LittleEndian.Uint32(b[8:12]))),
	}
}

func calculateTriangleArea(p1, p2, p3 Point3D) float64 {
	ax, ay, az := p2.X-p1.X, p2.Y-p1.Y, p2.Z-p1.Z
	bx, by, bz := p3.X-p1.X, p3.Y-p1.Y, p3.Z-p1.Z

	cx := ay*bz - az*by
	cy := az*bx - ax*bz
	cz := ax*by - ay*bx

	return 0.5 * math.Sqrt(cx*cx+cy*cy+cz*cz)
}

// CalculateWeightAndHours estimates 3D print weight (g), hours (h), and suggested price
func CalculateWeightAndHours(mesh MeshAnalysis, material string, infillPercent int) SliceResult {
	if material == "" {
		material = "PLA"
	}
	density, ok := materialDensities[strings.ToUpper(material)]
	if !ok {
		density = 1.24
	}

	if infillPercent <= 0 {
		infillPercent = 20
	} else if infillPercent > 100 {
		infillPercent = 100
	}

	// Shell ratio: ~20% walls, top and bottom solid layers
	shellRatio := 0.20
	infillRatio := float64(infillPercent) / 100.0
	effectiveVolRatio := shellRatio + (1.0-shellRatio)*infillRatio

	effectiveVolCm3 := mesh.VolumeCm3 * effectiveVolRatio
	weightG := math.Max(5.0, math.Round(effectiveVolCm3*density*10)/10)

	// Extrusion print speed: ~16g per hour
	hours := math.Max(0.5, math.Round((weightG/16.0)*10)/10)

	// Pricing calculation: Material cost + Machine hour cost
	matMultiplier := 1.0
	switch strings.ToUpper(material) {
	case "RESIN":
		matMultiplier = 1.8
	case "PETG":
		matMultiplier = 1.25
	case "TPU":
		matMultiplier = 1.5
	case "ABS":
		matMultiplier = 1.15
	}

	price := math.Round((weightG*0.45 + hours*14.0) * matMultiplier)
	if price < 25.0 {
		price = 25.0
	}

	return SliceResult{
		Mesh:             mesh,
		MaterialType:     material,
		InfillPercent:    infillPercent,
		EstimatedWeightG: weightG,
		EstimatedHours:   hours,
		EstimatedPrice:   price,
	}
}

// Ensure bytes buffer implements io.Reader
var _ io.Reader = (*bytes.Reader)(nil)
