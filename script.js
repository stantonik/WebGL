/**
 * @class       : script
 * @author      : stanleyarn (stanleyarn@$HOSTNAME)
 * @created     : Monday Oct 28, 2024 17:54:40 GMT
 * @description : script
 */

const width = 1920.0;
const height = 1080.0;
var gl;
var program;

async function init()
{
        const gl_canvas = document.getElementById("context");

        gl_canvas.height = height;
        gl_canvas.width = width;

        gl = gl_canvas.getContext("webgl2");

        if (gl === null)
        {
                console.log("unable to initialize WebGL");
                return;
        }
        else
        {
                console.log("succesfully initialize WebGL");
        }

        // Create vertex shader
        let success;
        let response = await fetch('./shader.vert');
        let text = await response.text();

        const vertex = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertex, text);
        gl.compileShader(vertex);
        success = gl.getShaderParameter(vertex, gl.COMPILE_STATUS);
        if (!success)
        {
                const log = gl.getShaderInfoLog(vertex);
                console.log("vertex shader error : " + log);
                return;
        }

        // Create fragment shader
        response = await fetch('./shader.frag');
        text = await response.text();

        const fragment = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragment, text);
        gl.compileShader(fragment);
        success = gl.getShaderParameter(fragment, gl.COMPILE_STATUS);
        if (!success)
        {
                const log = gl.getShaderInfoLog(fragment);
                console.log("framgent shader error : " + log);
                return;
        }

        program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!success)
        {
                const log = gl.getProgramInfoLog(program);
                console.log("program error : " + log);
                return;
        }

        gl.useProgram(program);

        const res_loc = gl.getUniformLocation(program, "iResolution");
        gl.uniform2f(res_loc, width, height);

        // Create screen for ray marching
        const screen_vertex = new Float32Array([
                -1.0, 1.0,
                -1.0, -1.0,
                1.0, -1.0,
                1.0, -1.0,
                1.0, 1.0,
                -1.0, 1.0,
        ]);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, screen_vertex, gl.STATIC_DRAW);

        const positionLocation = gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);
        gl.enableVertexAttribArray(positionLocation);

        // Transfert mars radius data
        const map_res = 4;
        const line = map_res * 180;
        const line_sample = map_res * 360;
        const radius_array_8_3 = new Uint8Array(3 * line * line_sample);

        response = await fetch("./mola_radius.txt");
        text = await response.text();

        const radiusArray = text.split('\n').map(line => parseInt(line.trim(), 10))
        const radius_array_32 = new Uint32Array(radiusArray);

        const map_res_loc = gl.getUniformLocation(program, "mars_map_res");
        gl.uniform1f(map_res_loc , parseFloat(map_res));

        for (let i = 0; i < line * line_sample; i++)
        {
                let byte1 = (radius_array_32[i] >> 16) & 0xFF; 
                let byte2 = (radius_array_32[i] >> 8) & 0xFF;
                let byte3 = radius_array_32[i] & 0xFF;

                radius_array_8_3[i * 3] = byte1;
                radius_array_8_3[i * 3 + 1] = byte2;
                radius_array_8_3[i * 3 + 2] = byte3;
        }

        const radius_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, radius_texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8UI, line_sample, line, 0, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, radius_array_8_3);

        gl.bindTexture(gl.TEXTURE_2D, null);

        const texture_unit = 0;
        gl.activeTexture(gl.TEXTURE0 + texture_unit);
        gl.bindTexture(gl.TEXTURE_2D, radius_texture);

        const radius_tex_loc = gl.getUniformLocation(program, "radius_data");
        gl.uniform1i(radius_tex_loc, texture_unit); 
}

var theta = 0;
var xpos = 0;
var ypos = 0;
const fps_span = document.getElementById("fps");
let start_time;
let last_time = 0;
let timer = 0;

function loop(timestamp)
{
        if (start_time === undefined) 
        {
                start_time = timestamp;
        }

        const delta_time = timestamp - last_time;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const time_loc = gl.getUniformLocation(program, "iTime");
        gl.uniform1f(time_loc , delta_time / 1000.0);

        theta = 0.5;
        const mouse_loc = gl.getUniformLocation(program, "iMouse");
        gl.uniform2f(mouse_loc, xpos, ypos);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (timer >= 1000)
        {
                timer = 0;
                fps_span.innerHTML = String(parseInt(1000.0 / delta_time));
        }

        timer += delta_time;

        last_time = timestamp;
        requestAnimationFrame(loop);
}

async function start()
{
        await init();

        document.getElementById("context").addEventListener("mousemove", function(event)
                {
                        var rect = event.target.getBoundingClientRect();
                        let x = Math.floor((event.clientX - rect.left) * (width / rect.width));
                        let y = Math.floor((event.clientY - rect.top) * (height / rect.height));
                        let _position = `X: ${x}, Y: ${y}`;
                        xpos = x;
                        ypos = y;

                        document.getElementById("cursor-pos").innerHTML = _position;
                })

        requestAnimationFrame(loop);
}

start();
