/**
 * Fast WebGL YUV420p (I420) to RGB renderer for HTML5 Canvas.
 * Uses preserveDrawingBuffer so screenshot & MediaRecorder captureStream work.
 */
export class YuvWebGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private yTex: WebGLTexture;
  private uTex: WebGLTexture;
  private vTex: WebGLTexture;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      throw new Error('WebGL tidak tersedia');
    }
    this.gl = gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D y_tex;
      uniform sampler2D u_tex;
      uniform sampler2D v_tex;
      void main() {
        float y = (texture2D(y_tex, v_texCoord).r - 0.062745) * 1.164383;
        float u = texture2D(u_tex, v_texCoord).r - 0.5;
        float v = texture2D(v_tex, v_texCoord).r - 0.5;
        float r = y + 1.596027 * v;
        float g = y - 0.391762 * u - 0.812968 * v;
        float b = y + 2.017232 * u;
        gl_FragColor = vec4(clamp(vec3(r, g, b), 0.0, 1.0), 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    this.program = program;

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
      gl.STATIC_DRAW
    );
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    this.yTex = this.createTexture(0, 'y_tex');
    this.uTex = this.createTexture(1, 'u_tex');
    this.vTex = this.createTexture(2, 'v_tex');

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    return shader;
  }

  private createTexture(unit: number, uniformName: string): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program, uniformName), unit);
    return tex;
  }

  render(yuv: Uint8Array, width: number, height: number) {
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);

    const ySize = width * height;
    const uvW = width >> 1;
    const uvH = height >> 1;
    const uvSize = uvW * uvH;

    const yPlane = yuv.subarray(0, ySize);
    const uPlane = yuv.subarray(ySize, ySize + uvSize);
    const vPlane = yuv.subarray(ySize + uvSize, ySize + uvSize * 2);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.yTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, yPlane);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.uTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, uvW, uvH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uPlane);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.vTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, uvW, uvH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, vPlane);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
