/**
 * @class       : script
 * @author      : stanleyarn (stanleyarn@$HOSTNAME)
 * @created     : Monday Oct 28, 2024 17:54:40 GMT
 * @description : script
 */

const gl_canvas = document.getElementById("context");

gl_canvas.height = 400;
gl_canvas.width = 800;

const gl = gl_canvas.getContext("webgl");

if (gl === null)
{
        console.log("unable to initialize WebGL");
}
else
{
        console.log("succesfully initialize WebGL");
}

gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
