/**
 * @class       : script
 * @author      : stanleyarn (stanleyarn@$HOSTNAME)
 * @created     : Monday Oct 28, 2024 17:54:40 GMT
 * @description : script
 */

const width = 1000.0;
const height = 600.0;
var delta_time = 0;
var gl;
var program;

async function init()
{
        const gl_canvas = document.getElementById("context");

        gl_canvas.height = height;
        gl_canvas.width = width;

        gl = gl_canvas.getContext("webgl");

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
        let response = await fetch('./vertex.shader');
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
        response = await fetch('./fragment.shader');
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

        const resolutionLocation = gl.getUniformLocation(program, "iResolution");
        gl.uniform2f(resolutionLocation, width, height);

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
}

function loop(delta_time)
{
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const resolutionLocation = gl.getUniformLocation(program, "iTime");
        gl.uniform1f(resolutionLocation, delta_time / 1000.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(loop);
}

async function start()
{
        await init();
        requestAnimationFrame(loop);
}

start();
