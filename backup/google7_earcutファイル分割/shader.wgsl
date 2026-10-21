struct DrawCommand {
    color: vec4f,
    thickness: f32,
    index_base: u32,
    index_count: u32,
    fig_type: u32,       // 0: Polygon, 1: Polyline
    vertex_base: u32,
    _pad1: u32,          // 16バイトアライメントのためのパディング
    _pad2: u32,
}

struct Uniforms {
	u_resolution: vec2f,
	u_zoom: f32,
	_pad: f32,
	u_offset: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> all_vertices: array<vec2f>;
@group(0) @binding(2) var<storage, read> all_indices: array<u32>;
@group(0) @binding(3) var<storage, read> commands: array<DrawCommand>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) v_idx: u32,
  @builtin(instance_index) inst_idx: u32
) -> VertexOutput {
  var output: VertexOutput;
  let cmd = commands[inst_idx];
  output.color = cmd.color;

// ------------------------------------------
// パターン0: ポリゴン
// ------------------------------------------
  if (cmd.fig_type == 0u) {
    if (v_idx >= cmd.index_count) {
      output.position = vec4f(0.0, 0.0, 0.0, 0.0);
      return output;
    }
    let global_idx = cmd.index_base + v_idx;
    let local_vert_idx = all_indices[global_idx];
    let raw_pos = all_vertices[cmd.vertex_base + local_vert_idx];

    // ★ ここでカメラ変換を適用！
    let cam_pos = (raw_pos - uniforms.u_offset) * uniforms.u_zoom;
    output.position = vec4f(cam_pos, 0.0, 1.0);
    return output;
  }

  // ------------------------------------------
  // パターン1: 太い折れ線（ズーム不変幅版）
  // ------------------------------------------
  if (cmd.fig_type == 1u) {
    let segment_idx = v_idx / 6u;
    let corner_idx = v_idx % 6u;

    if (segment_idx >= cmd.index_count - 1u) {
      output.position = vec4f(0.0, 0.0, 0.0, 0.0);
      return output;
    }

    let p0 = all_vertices[cmd.vertex_base + segment_idx];
    let p1 = all_vertices[cmd.vertex_base + segment_idx + 1u];

    // 1. 先に「線の中心軸の頂点（p0, p1）」だけをカメラ（ズーム・オフセット）で移動させる！
    let cam_p0 = (p0 - uniforms.u_offset) * uniforms.u_zoom;
    let cam_p1 = (p1 - uniforms.u_offset) * uniforms.u_zoom;

    // 2. カメラ移動「後」の座標を使って、画面上での方向と法線を計算する
    let aspect = uniforms.u_resolution.x / uniforms.u_resolution.y;
    let dir = normalize(vec2f(cam_p1.x * aspect, cam_p1.y) - vec2f(cam_p0.x * aspect, cam_p0.y));
    let normal = vec2f(-dir.y, dir.x);

    // 3. 太さの計算（u_zoom を掛けないため、画面上でのピクセル幅が常に一定になる）
    let thickness_ndc = cmd.thickness / uniforms.u_resolution.y;
    let offset = vec2f((normal.x * thickness_ndc * 0.5) / aspect, normal.y * thickness_ndc * 0.5);

    // 4. カメラ移動後の中心位置に、太さのオフセットを加算する
    var final_pos = vec2f(0.0);
    if (corner_idx == 0u) { final_pos = cam_p0 + offset; }
    else if (corner_idx == 1u || corner_idx == 4u) { final_pos = cam_p0 - offset; }
    else if (corner_idx == 2u || corner_idx == 3u) { final_pos = cam_p1 + offset; }
    else if (corner_idx == 5u) { final_pos = cam_p1 - offset; }

    output.position = vec4f(final_pos, 0.0, 1.0);
    return output;
  }

  // ------------------------------------------
  // パターン2: 関節の Round Join（ズーム不変幅版）
  // ------------------------------------------
  if (cmd.fig_type == 2u) {
      let total_circle_vertices = cmd.index_count * 3u;
      if (v_idx >= total_circle_vertices) {
          output.position = vec4f(0.0, 0.0, 0.0, 0.0);
          return output;
      }

      let tri_idx = v_idx / 3u;
      let sub_idx = v_idx % 3u;

      let center_pos = all_vertices[cmd.vertex_base + cmd.index_base];

      // 1. 先に「関節の中心点」をカメラで移動させる
      let cam_center = (center_pos - uniforms.u_offset) * uniforms.u_zoom;
      var final_pos = cam_center;

      if (sub_idx > 0u) {
          var vertex_on_ring = tri_idx;
          if (sub_idx == 2u) {
              vertex_on_ring = (tri_idx + 1u) % cmd.index_count;
          }

          let angle = (f32(vertex_on_ring) / f32(cmd.index_count)) * 2.0 * 3.14159265;
          let raw_offset = vec2f(cos(angle), sin(angle));

          let aspect = uniforms.u_resolution.x / uniforms.u_resolution.y;
          let radius_ndc = (cmd.thickness * 0.5) / uniforms.u_resolution.y; // u_zoom を掛けない

          let offset = vec2f((raw_offset.x * radius_ndc) / aspect, raw_offset.y * radius_ndc);
          final_pos = cam_center + offset;
      }

      output.position = vec4f(final_pos, 0.0, 1.0);
      return output;
  }
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
