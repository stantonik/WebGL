#version 300 es

precision highp float;
precision highp usampler2D;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;

uniform usampler2D radius_data;
uniform float mars_map_res;

out vec4 color;

#define MAX_DIST 100.0
#define MIN_DIST 0.001
#define NUMBER_OF_STEPS 128
#define PI 3.1415926535897932384626433832795

const vec3 light_color = vec3(1);
const vec3 light_source = vec3(5.0, 0.0, 5.0);
const float sun_radius = 3.0;

const float mars_radius = 1.0;
const vec3 mars_color = vec3(0.68, 0.2, 0.0);

vec3 rotx(vec3 p, float theta)
{
        float yc = cos(theta) * p.y - sin(theta) * p.z;
        float zc = sin(theta) * p.y + cos(theta) * p.z;

        return vec3(p.x, yc, zc);
}

vec3 roty(vec3 p, float theta)
{
        float xc = cos(theta) * p.x + sin(theta) * p.z;
        float zc = -sin(theta) * p.x + cos(theta) * p.z;

        return vec3(xc, p.y, zc);
}

float sd_sphere(vec3 p, float r)
{
        return length(p) - r;
}

float sd_mars(vec3 p)
{
        float lat = (asin(p.y / length(p))) * (180.0 / PI); // -90 -> 90
        float lon = (atan(p.z, p.x) + PI) * (180.0 / PI); // 0 -> 360

        float line = floor((lat + 90.0) * mars_map_res);
        float line_sample = floor(lon * mars_map_res);

        vec2 uv = vec2(line_sample / 360.0, line / 180.0) / mars_map_res;

        uvec3 radius_rgb = texture(radius_data, uv).xyz;
        uint uradius = (radius_rgb.x << 16) | (radius_rgb.y << 8) | radius_rgb.z;
        float radius = float(uradius);

        radius /= 3396000.0;

        return length(p) - radius;
}

vec3 world_transform(vec3 p)
{
        vec2 m = iMouse.xy / iResolution.xy;
        p = roty(p, m.x * 2.0 * 3.14);

        return p;
}

float map(vec3 p)
{
        vec2 m = iMouse.xy / iResolution.xy;

        vec3 mars_pos = world_transform(p);
        vec3 sun_pos = world_transform(light_source) - p;
        // vec3 sun_pos = light_source;

        // float mars = sd_sphere(mars_pos, mars_radius);
        float mars = sd_mars(p / 2.0) * 2.0;
        float sun = sd_sphere(sun_pos, sun_radius);

        return min(mars, min(sun, MAX_DIST));
}

vec3 get_normal(vec3 p)
{
        vec2 d = vec2(0.01, 0.0);
        vec3 g;
        g.x = map(p + d.xyy) - map(p - d.xyy);
        g.y = map(p + d.yxy) - map(p - d.yxy);
        g.z = map(p + d.yyx) - map(p - d.yyx);
        return normalize(g);
}

float ray_marching(vec3 ro, vec3 rd, float max_dist)
{
        float dist = 0.0;
        for (int i = 0; i < NUMBER_OF_STEPS; i++)
        {
                vec3 p = ro + rd * dist;     
                float d = map(p);

                if (d < MIN_DIST) break;

                dist += d;

                if (dist > max_dist) break;
        }

        return dist;
}

vec3 render(vec2 uv)
{
        vec3 color = vec3(0.0);

        vec3 ro = vec3(0.0, 0.0, -3.0);
        vec3 rd = normalize(vec3(uv, 1.0));

        float dist = ray_marching(ro, rd, MAX_DIST);

        if (dist < MAX_DIST)
        {
                vec3 p = ro + rd * dist;

                // Ambient lighting
                float ambient_strength = 0.15;

                // Diffuse lightning
                float diffuse_strength = max(ambient_strength, dot(normalize(world_transform(light_source)), get_normal(p)));
                vec3 diffuse = light_color * diffuse_strength;

                // Colorise objects
                if (sd_sphere(world_transform(light_source) - p, sun_radius) < 0.1)
                {
                        color = vec3(1.0, 0.8, 0.3) * 1.1;
                }
                else
                {
                        color = diffuse * mars_color;
                }
        }
        else
        {
                // Background color
                color = vec3(0.0);
        }

        return color;
}

void main()
{
        vec2 uv = 2.0 * gl_FragCoord.xy / iResolution.xy - 1.0;
        uv.x *= iResolution.x / iResolution.y;
        color = vec4(render(uv), 1.0);
}
