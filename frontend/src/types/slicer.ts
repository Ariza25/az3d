export interface SlicerConfigDetails {
  quality: {
    layer_height?: string;
    initial_layer_height?: string;
    line_width?: string;
    seam_position?: string;
  };
  strength: {
    wall_loops?: string;
    top_shell_layers?: string;
    bottom_shell_layers?: string;
    infill_density?: string;
    infill_pattern?: string;
  };
  speed: {
    outer_wall_speed?: string;
    inner_wall_speed?: string;
    infill_speed?: string;
    travel_speed?: string;
    initial_layer_speed?: string;
  };
  support: {
    enabled: boolean;
    support_type?: string;
    support_style?: string;
    threshold_angle?: string;
  };
  others: {
    brim_type?: string;
    nozzle_temperature?: string;
    bed_temperature?: string;
    printer_model?: string;
    nozzle_diameter?: string;
  };
}

export interface Parsed3MFResult {
  product_weight_grams: number;
  support_weight_grams: number;
  print_minutes: number;
  dimensions: string;
  dim_x_mm?: number;
  dim_y_mm?: number;
  dim_z_mm?: number;
  material?: string;
  layer_height?: string;
  infill_percent?: number;
  slicer_detected?: string;
  file_name: string;
  thumbnail_base64?: string;
  settings?: SlicerConfigDetails;
  raw_settings_json?: string;
}
