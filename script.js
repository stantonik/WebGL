/**
 * @class       : script
 * @author      : stanleyarn (stanleyarn@$HOSTNAME)
 * @created     : Monday Oct 28, 2024 17:54:40 GMT
 * @description : script
 */

const gl_canvas = document.getElementById("context");
const WIDTH = 1920.0;
const HEIGHT = 1080.0;
const ZOOM_SENSITIVITY = 0.01;
var gl;
var program;
var uniform_loc = {}

async function initgl()
{
        gl_canvas.height = HEIGHT;
        gl_canvas.width = WIDTH;

        gl = gl_canvas.getContext("webgl2");
        if (gl === null)
        {
                console.log("unable to initialize WebGL2");
                return;
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

        // Create program
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
        set_uniform_locations();

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

        gl.uniform2f(uniform_loc["iResolution"], WIDTH, HEIGHT);

        const positionLocation = gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 2 * 4, 0);
        gl.enableVertexAttribArray(positionLocation);

        // Transfert mars radius texture
        const map_res = 4;
        const line = map_res * 180;
        const line_sample = map_res * 360;
        const radius_array_8_3 = new Uint8Array(3 * line * line_sample);

        console.log("reading mars elevation data...");
        response = await fetch("./megr90n000cb.img");
        const array_buffer = await response.arrayBuffer();
        const data_view = new DataView(array_buffer);

        for (let i = 0; i < data_view.byteLength; i += 2) 
        {
                let j = i / 2;
                // Read each 16-bit integer in big-endian format then convert it in uint32
                let radius = (data_view.getInt16(i, false) + 3396000.0) >>> 0;

                // Split it in 3 uint8
                radius_array_8_3[j * 3] = (radius >> 16) & 0xFF;
                radius_array_8_3[j * 3 + 1] = (radius >> 8) & 0xFF;
                radius_array_8_3[j * 3 + 2] = radius & 0xFF;
        }

        const radius_texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, radius_texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8UI, line_sample, line, 0, gl.RGB_INTEGER, gl.UNSIGNED_BYTE, radius_array_8_3);

        gl.bindTexture(gl.TEXTURE_2D, null);

        const texture_unit = 0;
        gl.activeTexture(gl.TEXTURE0 + texture_unit);
        gl.bindTexture(gl.TEXTURE_2D, radius_texture);

        gl.uniform1i(uniform_loc["radius_data"], texture_unit); 
        gl.uniform1f(uniform_loc["mars_map_res"], parseFloat(map_res));

        console.log("ready");
}

function set_uniform_locations()
{
        uniform_loc["iResolution"] = gl.getUniformLocation(program, "iResolution");
        uniform_loc["sun_rot"] = gl.getUniformLocation(program, "sun_rot");
        uniform_loc["radius_data"] = gl.getUniformLocation(program, "radius_data");
        uniform_loc["mars_map_res"] = gl.getUniformLocation(program, "mars_map_res");
        uniform_loc["cam_rot"] = gl.getUniformLocation(program, "cam_rot");
        uniform_loc["cam_zoom"] = gl.getUniformLocation(program, "cam_zoom");
}

async function start()
{
        await initgl();

        // Handle mouse move
        var xpos = 0;
        var ypos = 0;
        var last_xpos = 0;
        var last_ypos = 0;
        var mouse_state = 0;
        var cam_roty = 0.0;
        var cam_rotx = 0.0;
        function handle_rotate(dx, dy)
        {
                cam_roty += dx / WIDTH * 2.0 * Math.PI;
                cam_rotx += dy / HEIGHT * 2.0 * Math.PI;

                if (cam_rotx > Math.PI / 2.0 - 0.1) cam_rotx = Math.PI / 2.0 - 0.1;
                else if (cam_rotx < -Math.PI / 2.0 + 0.1) cam_rotx = -Math.PI / 2.0 + 0.1;

                gl.uniform2f(uniform_loc["cam_rot"], cam_rotx, cam_roty);
        }

        function update_cursor_pos(event)
        {
                var rect = gl_canvas.getBoundingClientRect();
                xpos = Math.floor((event.clientX - rect.left) * (WIDTH / rect.width));
                ypos = Math.floor((event.clientY - rect.top) * (HEIGHT / rect.height));
        }

        gl_canvas.addEventListener("mousedown", (event) => {
                mouse_state = 1;
                update_cursor_pos(event);
                last_xpos = xpos;
                last_ypos = ypos;
        });
        gl_canvas.addEventListener("mouseup", () => mouse_state = 0);
        gl_canvas.addEventListener("mousemove", function(event)
                {
                        if (mouse_state === 1)
                        {
                                event.preventDefault();

                                update_cursor_pos(event);
                                handle_rotate(xpos - last_xpos, ypos - last_ypos);

                                last_xpos = xpos;
                                last_ypos = ypos;
                        }
                })

        // Handle zoom and touch events
        let cam_zoom = 2.0;
        gl.uniform1f(uniform_loc["cam_zoom"], cam_zoom);
        let lastDist = null;

        gl_canvas.addEventListener("touchstart", (event) => {
                if (event.touches.length === 1) 
                {
                        mouse_state = 1;
                        const touch = event.touches[0];
                        update_cursor_pos(touch);
                        last_xpos = xpos;
                        last_ypos = ypos;
                }
        });
        gl_canvas.addEventListener("touchend", (event) => {
                if (event.touches.length <= 1) lastDist = null; 
                mouse_state = 0;
        } );
        gl_canvas.addEventListener("touchmove", function handleTouchMove(event)
                {
                        event.preventDefault();
                        if (mouse_state === 1 && event.touches.length === 1) {
                                const touch = event.touches[0];

                                update_cursor_pos(touch);
                                handle_rotate(xpos - last_xpos, ypos - last_ypos);

                                last_xpos = xpos;
                                last_ypos = ypos;
                        }
                        else if (event.touches.length === 2) 
                        {
                                const touch1 = event.touches[0];
                                const touch2 = event.touches[1];

                                const dx = touch2.clientX - touch1.clientX;
                                const dy = touch2.clientY - touch1.clientY;
                                const currentDist = Math.sqrt(dx * dx + dy * dy);

                                if (lastDist) 
                                {
                                        const zoomChange = (currentDist - lastDist) * ZOOM_SENSITIVITY;

                                        cam_zoom += zoomChange;
                                        if (cam_zoom < 0.1) cam_zoom = 0.1;
                                        else if (cam_zoom > 5.0) cam_zoom = 5.0;

                                        gl.uniform1f(uniform_loc["cam_zoom"], cam_zoom);
                                }
                                lastDist = currentDist;
                        }
                });

        gl_canvas.addEventListener("wheel", function handleWheel(event) 
                {
                        event.preventDefault();

                        cam_zoom += event.deltaY * -ZOOM_SENSITIVITY;
                        if (cam_zoom < 0.1) cam_zoom = 0.1;
                        else if (cam_zoom > 5.0) cam_zoom = 5.0;

                        gl.uniform1f(uniform_loc["cam_zoom"], cam_zoom);
                });

        // Handle sun rot
        document.getElementById("sun-rot").addEventListener('input', function(event) 
                {
                        gl.uniform1f(uniform_loc["sun_rot"], parseFloat(event.target.value) * Math.PI / 180.0);
                });

        var start_time;
        var last_time = 0;
        var timer = 0;

        const fps_span = document.getElementById("fps");

        function loop(timestamp)
        {
                if (start_time === undefined) start_time = timestamp;
                const delta_time = (timestamp - last_time) / 1000.0;

                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);

                const time_loc = gl.getUniformLocation(program, "iTime");
                gl.uniform1f(time_loc , delta_time);

                gl.drawArrays(gl.TRIANGLES, 0, 6);

                if (timer == 0 || timer >= 0.5)
                {
                        timer = 0;
                        fps_span.innerHTML = String(parseInt(1.0 / delta_time));
                }

                timer += delta_time;

                last_time = timestamp;
                requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
}

start();
