#version 300 es

precision highp float;
precision highp usampler2D;

uniform vec2 iResolution;
uniform float iTime;

uniform usampler2D radius_data;
uniform float mars_map_res;
uniform float sun_rot;
uniform vec2 cam_rot;
uniform float cam_zoom;

out vec4 color;

#define MAX_DIST 100.0
#define MIN_DIST 1.0e-6
#define NUMBER_OF_STEPS 128
#define PI 3.1415926535897932384626433832795

// Camera settings
vec3 cam_origin = vec3(0.0, 0.0, -3.0);
vec3 cam_target = vec3(0.0);
float cam_fov = 40.0;

// Sun settings
vec3 light_color = vec3(1);
vec3 light_source = vec3(5.0, 0.0, 5.0);
const float sun_radius = 3.0;

// Mars settings
const vec3 mars_color = vec3(0.68, 0.2, 0.0);


// Mathematicals function
vec3 rotate(vec3 v, float angle, vec3 axis) 
{
        axis = normalize(axis);
        float cosA = cos(angle);
        float sinA = sin(angle);

        return v * cosA + cross(axis, v) * sinA + axis * dot(axis, v) * (1.0 - cosA);
}

float map(vec3);
vec3 get_normal(vec3 p)
{
        vec2 d = vec2(0.01, 0.0);
        vec3 g;
        g.x = map(p + d.xyy) - map(p - d.xyy);
        g.y = map(p + d.yxy) - map(p - d.yxy);
        g.z = map(p + d.yyx) - map(p - d.yyx);
        return normalize(g);
}

float rand(vec3 st) 
{
        return fract(sin(dot(st, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// SDFs
float sd_sphere(vec3 p, float r)
{
        return length(p) - r;
}

// cf. inigo quilez
float sd_stars(vec3 p)
{
        if (p.y > 30.0 || p.y < -30.0) return MAX_DIST;
        p.y = fract(p.y) - 0.5;

        const int n = 70;
        const float b = 6.283185 / float(n);
        float angle = atan(p.z, p.x);
        float sectorIndex = floor(angle / b);

        float angle1 = b * sectorIndex;
        float angle2 = b * (sectorIndex + 1.0);

        vec2 rotatedP1 = mat2(cos(angle1), -sin(angle1), sin(angle1), cos(angle1)) * p.xz;
        vec2 rotatedP2 = mat2(cos(angle2), -sin(angle2), sin(angle2), cos(angle2)) * p.xz;

        vec3 dec = vec3(30.0, 0.0, 0.0);
        vec3 p1 = vec3(rotatedP1.x, p.y, rotatedP1.y) - dec;
        vec3 p2 = vec3(rotatedP2.x, p.y, rotatedP2.y) - dec;

        return min(sd_sphere(p1, 0.05), sd_sphere(p2, 0.05));
}

float sd_mars(vec3 p)
{
        float lat = (asin(p.y / length(p))) * (180.0 / PI); // -90 -> 90
        float lon = (atan(p.z, p.x) + PI) * (180.0 / PI); // 0 -> 360

        float line = floor((lat + 90.0) * mars_map_res);
        float line_sample = floor(lon * mars_map_res);

        vec2 uv = vec2(line_sample / 360.0, line / 180.0) / mars_map_res;

        uvec3 radius_rgb = texture(radius_data, uv).rgb;
        float radius = float((radius_rgb.r << 16) | (radius_rgb.g << 8) | radius_rgb.b) / 3396000.0;

        // Exagerate a bit the radius
        return length(p) - pow(radius, 2.0);
}

float get_glow(float dist, float radius, float intensity)
{
        return pow(radius / max(dist, 1e-6), intensity);	
}

// Map
float map(vec3 p)
{
        vec3 mars_pos = p;
        vec3 sun_pos = light_source - p;

        float mars = sd_mars(mars_pos / 1.0) * 1.0;
        float sun = sd_sphere(sun_pos, sun_radius);
        float stars = sd_stars(p);

        return min(mars, min(sun, stars));
}

// Core
float ray_marching(vec3 ro, vec3 rd, float max_dist, inout float glow)
{
        float dist = 0.0;
        for (int i = 0; i < NUMBER_OF_STEPS; i++)
        {
                vec3 p = ro + rd * dist;     
                float d = map(p);

                float dsun = sd_sphere(light_source - p, sun_radius);
                glow += get_glow(dsun, 5e-3, 0.8);

                if (d < MIN_DIST) break;

                dist += d;

                if (dist > max_dist) break;
        }

        return dist;
}

vec3 render(vec2 uv)
{
        vec3 color = vec3(0.0);

        float scale = tan(radians(cam_fov * (cam_zoom * 0.4 + 0.4) * 0.5));

        cam_origin = rotate(cam_origin - cam_target, cam_rot.y, vec3(0, 1, 0)) + cam_target;

        vec3 forward = normalize(cam_target - cam_origin);
        vec3 right = normalize(cross(vec3(0, 1, 0), forward));

        cam_origin = rotate(cam_origin - cam_target, cam_rot.x, right) + cam_target;

        forward = normalize(cam_target - cam_origin);
        right = normalize(cross(vec3(0, 1, 0), forward));
        vec3 up = cross(forward, right);

        vec3 cam_dir = normalize(forward + uv.x * scale * right + uv.y * scale * up);

        float glow = 0.0;
        float dist = ray_marching(cam_origin, cam_dir, MAX_DIST, glow);

        if (dist < MAX_DIST)
        {
                vec3 p = cam_origin + cam_dir * dist;

                // Ambient lighting
                vec3 ambient = vec3(1.0); 

                // Diffuse lightning
                vec3 normal = get_normal(p);
                float diffuse_strength = max(0.0, dot(normalize(light_source), normal));
                vec3 diffuse = light_color * diffuse_strength;

                // Specular lighting
                vec3 reflect_source = normalize(reflect(-light_source, normal));
                float specular_strength = pow(max(0.0, dot(normalize(cam_origin), reflect_source)), 15.0);
                vec3 specular = specular_strength * light_color;

                vec3 lighting = vec3(0.0);
                lighting = ambient * 0.1 + diffuse * 0.8 + specular * 0.3;

                // Colorise objects
                if (sd_stars(p) < 0.1)
                {
                        float k = rand(floor(p) * 2.0);
                        if (k < 0.95) k = 0.0;

                        color = vec3(1) * k;
                }
                else
                {
                        color = mars_color * lighting;
                }
        }
        else
        {
                color = vec3(0);
        }

        // Add sun glow with screen blending
        color = 1.0 - (1.0 - color) * (1.0 - glow * vec3(1.0, 0.9, 0.6));

        // Gamma
        // color = pow(color, vec3(0.4545));

        return color;
}

void main()
{
        vec2 uv = 2.0 * gl_FragCoord.xy / iResolution.xy - 1.0;
        uv.x *= iResolution.x / iResolution.y;

        light_source = rotate(light_source, sun_rot, vec3(0.0, 1.0, 0.0));

        color = vec4(render(uv), 1.0);
}
