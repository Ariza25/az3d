package stlparser

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func createCubeBinarySTL(sideMm float32) []byte {
	// A cube side x side x side has 12 triangles (2 per face)
	var buf bytes.Buffer

	// 80-byte header
	header := make([]byte, 80)
	copy(header, []byte("AZ3D Test Cube STL Binary Data"))
	buf.Write(header)

	// 12 triangles
	numTriangles := uint32(12)
	binary.Write(&buf, binary.LittleEndian, numTriangles)

	// Define 8 vertices of a cube [0, side] x [0, side] x [0, side]
	s := sideMm
	v := [8][3]float32{
		{0, 0, 0}, {s, 0, 0}, {s, s, 0}, {0, s, 0},
		{0, 0, s}, {s, 0, s}, {s, s, s}, {0, s, s},
	}

	faces := [][3]int{
		{0, 2, 1}, {0, 3, 2}, // Bottom
		{4, 5, 6}, {4, 6, 7}, // Top
		{0, 1, 5}, {0, 5, 4}, // Front
		{2, 3, 7}, {2, 7, 6}, // Back
		{0, 4, 7}, {0, 7, 3}, // Left
		{1, 2, 6}, {1, 6, 5}, // Right
	}

	for _, f := range faces {
		// Normal (dummy)
		binary.Write(&buf, binary.LittleEndian, float32(0))
		binary.Write(&buf, binary.LittleEndian, float32(0))
		binary.Write(&buf, binary.LittleEndian, float32(0))

		// Vertex 1, 2, 3
		binary.Write(&buf, binary.LittleEndian, v[f[0]][0])
		binary.Write(&buf, binary.LittleEndian, v[f[0]][1])
		binary.Write(&buf, binary.LittleEndian, v[f[0]][2])

		binary.Write(&buf, binary.LittleEndian, v[f[1]][0])
		binary.Write(&buf, binary.LittleEndian, v[f[1]][1])
		binary.Write(&buf, binary.LittleEndian, v[f[1]][2])

		binary.Write(&buf, binary.LittleEndian, v[f[2]][0])
		binary.Write(&buf, binary.LittleEndian, v[f[2]][1])
		binary.Write(&buf, binary.LittleEndian, v[f[2]][2])

		// Attribute byte count
		binary.Write(&buf, binary.LittleEndian, uint16(0))
	}

	return buf.Bytes()
}

func TestParseSTL_Cube(t *testing.T) {
	// 10mm x 10mm x 10mm cube = 1000 mm3 = 1.0 cm3
	stlBytes := createCubeBinarySTL(10.0)

	mesh, err := ParseSTL(bytes.NewReader(stlBytes))
	if err != nil {
		t.Fatalf("ParseSTL falhou: %v", err)
	}

	if mesh.TriangleCount != 12 {
		t.Errorf("Esperado 12 triângulos, obteve %d", mesh.TriangleCount)
	}

	if mesh.DimXMm != 10.0 || mesh.DimYMm != 10.0 || mesh.DimZMm != 10.0 {
		t.Errorf("Dimensões incorretas: obteve %.1fx%.1fx%.1f, esperado 10.0x10.0x10.0", mesh.DimXMm, mesh.DimYMm, mesh.DimZMm)
	}

	if mesh.VolumeCm3 < 0.9 || mesh.VolumeCm3 > 1.1 {
		t.Errorf("Volume incorreto: obteve %.2f cm3, esperado 1.00 cm3", mesh.VolumeCm3)
	}

	// Calculate slice result
	sliceRes := CalculateWeightAndHours(mesh, "PLA", 20)
	if sliceRes.EstimatedWeightG <= 0 {
		t.Errorf("Peso estimado deve ser maior que zero, obteve %.2fg", sliceRes.EstimatedWeightG)
	}
}
