precision mediump float;

uniform vec2 iResolution;
uniform float iTime;

float sdBox(vec3 p, vec3 b)
{
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float rand(vec2 co)
{
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float map(vec3 p)
{
    vec3 q = p;
    ivec3 iq = ivec3(int(floor(p.x)), int(floor(p.y)), int(floor(p.z)));
    
    if (iq.x == 1 && iq.z == 0) return 0.1;
    
    float ylevel = rand(vec2(float(iq.x) + iTime * 0.000001, float(iq.z))) * 2.0 - 4.0;
    if (iq.y > int(ylevel) && iq.y < 3) return 0.1;
    
    q = mod(q, 1.0) - 0.5;
    
    float box = sdBox(q, vec3(0.45));

    return box;
}

void main()
{
        float u = 2.0 * gl_FragCoord.x / iResolution.x - 1.0;
        float v = 2.0 * gl_FragCoord.y / iResolution.y - 1.0;
        v *= iResolution.y / iResolution.x;
        vec2 uv = vec2(u, v);

        vec3 ro = vec3(0.0, 0.0, -3.0);
        vec3 rd = normalize(vec3(uv, 1.0));

        float t = 0.0;

        for (int i = 0; i < 200; i++)
        {  
                vec3 p = ro + rd * t;

                float d = map(p);
                t += d;

                if (d < 0.001 || t > 100.0) break;
        }

        vec3 color = vec3(t) * 0.05;
        gl_FragColor = vec4(color, 1.0);
}
