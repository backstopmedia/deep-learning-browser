/**
*
* This software is released under MIT licence : 
*
* Copyright (c) 2018 Xavier Bourry ( xavier@jeeliz.com )
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/


/*
2D Thermal simulation of a square of iron heated at 100°C
The square is 2.56 meters large
The total area of the simulation is 2.56 meters
The duration of the simulation is 3000 seconds
*/

//parameters. Physical parameters are in the computing fragment shader
var SETTINGS={
    simuSize: 256,
    nIterations: 3000 //time step is 1 seconds. So the total duration of the simulation is nIterations seconds 
};

//global variables
var GL, FLOATPIXELTYPE, ISWEBGL2;

//test if it is possible to do RTT with FLOAT/HALF FLOAT textures :
function test_canRTT(internalFormat, pixelType){
    var testFbo=GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, testFbo);

    var testTexture=GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, testTexture);
    GL.texImage2D(GL.TEXTURE_2D, 0, internalFormat, 1, 1, 0, GL.RGBA, pixelType, null);

    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, testTexture, 0);
    var fbStatus=GL.checkFramebufferStatus(GL.FRAMEBUFFER);

    return(fbStatus===GL.FRAMEBUFFER_COMPLETE);
}

function enable_webGL12extensions(){
    GL.getExtension('EXT_color_buffer_float');
    GL.getExtension('WEBGL_color_buffer_float');
    GL.getExtension('OES_color_buffer_float');
}

function get_webgl1extensions(){
    if (GL.getExtension('OES_texture_float') && test_canRTT(GL.RGBA, GL.FLOAT)){
        FLOATPIXELTYPE=GL.FLOAT;
        return true;
    }
    if (GL.getExtension('OES_texture_half_float') && test_canRTT(GL.RGBA, GL.HALF_FLOAT)){
        FLOATPIXELTYPE=GL.HALF_FLOAT;
        return true;
    }
    return false;
}

//helper function to compile a shader
function compile_shader(source, type, typeString) {
  var shader = GL.createShader(type);
  GL.shaderSource(shader, source);
  GL.compileShader(shader);
  if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
    alert("ERROR IN "+typeString+ " SHADER : " + GL.getShaderInfoLog(shader));
    return false;
  }
  return shader;
};

//helper function to build the shader program :
function build_shaderProgram(shaderVertexSource, shaderFragmentSource, name) {
    //compile both shader separately
    var shaderVertex=compile_shader(shaderVertexSource, GL.VERTEX_SHADER, "VERTEX "+name);
    var shaderFragment=compile_shader(shaderFragmentSource, GL.FRAGMENT_SHADER, "FRAGMENT "+name);

    var shaderProgram=GL.createProgram();
    GL.attachShader(shaderProgram, shaderVertex);
    GL.attachShader(shaderProgram, shaderFragment);

    //start the linking stage :
    GL.linkProgram(shaderProgram);
    return shaderProgram;
}

function create_andBindVBOs(positionAttributePointer){
    // CREATE THE VERTEX BUFFER OBJECTS :
    //declare vertices and indices of a quad :
    var quadVertices = new Float32Array([
      -1, -1, //bottom left corner -> indice 0
      -1, 1,  //top left corner    -> indice 1
      1, 1,   //top right corner   -> indice 2
      1, -1  //bottom right corner -> indice 3
    ]);
    var quadIndices = new Uint16Array([
      0,1,2, //first triangle if made with points of indices 0,1,2
      0,2,3  //second triangle
    ]);

    //send vertices to the GPU :
    var quadVerticesVBO= GL.createBuffer();
    GL.bindBuffer(GL.ARRAY_BUFFER, quadVerticesVBO);
    GL.bufferData(GL.ARRAY_BUFFER, quadVertices, GL.STATIC_DRAW);

    //send indices to the GPU :
    var quadIndicesVBO= GL.createBuffer();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, quadIndicesVBO);
    GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, quadIndices, GL.STATIC_DRAW);

    //BIND VBOs
    GL.bindBuffer(GL.ARRAY_BUFFER, quadVerticesVBO);
    GL.vertexAttribPointer(positionAttributePointer, 2, GL.FLOAT, false, 8,0);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, quadIndicesVBO);    
}

//helper function to create a texture
function create_rttTexture(width, height, data){
    var texture=GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, texture);
    //texture filtering : always pick the nearest pixel from the texture UV coordinates :
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);

    //does not repeat texture along axis
    //(otherwise may throw errors if dimensions of the texture are not power of 2) :
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE );
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE );
    
    if (FLOATPIXELTYPE===GL.FLOAT){ //32 bit precision
        GL.texImage2D(GL.TEXTURE_2D, 0, (ISWEBGL2)?GL.RGBA32F:GL.RGBA, width, height, 0, GL.RGBA, FLOATPIXELTYPE, data);
    } else { //16 bits precision
        GL.texImage2D(GL.TEXTURE_2D, 0, (ISWEBGL2)?GL.RGBA16F:GL.RGBA, width, height, 0, GL.RGBA, FLOATPIXELTYPE, convert_arrayToUInt16Array(data));
    }
    return texture;
}

//convert a float value to Float16 encoding
//ref : https://esdiscuss.org/topic/float16array
function convert_floatToInt16(val){
    var floatView = new Float32Array(1);
    var int32View = new Int32Array(floatView.buffer);

    floatView[0] = val;
    var x = int32View[0];

    var bits = (x >> 16) & 0x8000; /* Get the sign */
    var m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
    var e = (x >> 23) & 0xff; /* Using int is faster here */

    /* If zero, or denormal, or exponent underflows too much for a denormal
     * half, return signed zero. */
    if (e < 103) {
      return bits;
    }

    /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
    if (e > 142) {
      bits |= 0x7c00;
      /* If exponent was 0xff and one mantissa bit was set, it means NaN,
       * not Inf, so make sure we set one mantissa bit too. */
      bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
      return bits;
    }

    /* If exponent underflows but not too much, return a denormal */
    if (e < 113) {
      m |= 0x0800;
      /* Extra rounding may overflow and set mantissa to 0 and exponent
       * to 1, which is OK. */
      bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
      return bits;
    }

    bits |= ((e - 112) << 10) | (m >> 1);
    /* Extra rounding. An overflow will set mantissa to 0 and increment
     * the exponent, which is OK. */
    bits += m & 1;
    return bits;
}; //end convert_floatToInt16()

//convert an array with float values or a Float32Array
//to an Uint16array with 16bits encoded float
//(see https://en.wikipedia.org/wiki/Half-precision_floating-point_format for the encoding)
function convert_arrayToUInt16Array(arr){
    var arr16=new Uint16Array(arr.length);
    arr.forEach(function(val, ind) {
        arr16[ind]=convert_floatToInt16(val);
    });
    return arr16;
};

//entry point :
function main(){

    // CREATE WEBGL CONTEXT :
    var myCanvas=document.getElementById('myWebGLCanvas');
    var webglOptions={antialias: false, depth: false};
    
    try {
      ISWEBGL2=true;
      GL=myCanvas.getContext('webgl2', webglOptions);
      enable_webGL12extensions();
      if (test_canRTT(GL.RGBA32F, GL.FLOAT)){
          FLOATPIXELTYPE=GL.FLOAT;
      } else {
          FLOATPIXELTYPE=GL.HALF_FLOAT;
      }
    } catch(e) { //no webgl2. try webgl1 ?

      console.log('WARNING : You are not compatible with WebGL2');
      try {
          ISWEBGL2=false;
          GL=myCanvas.getContext('webgl', webglOptions);
          enable_webGL12extensions();
          if (!get_webgl1extensions()){
              alert('WebGL2 is not here and cannot found right WebGL1 extensions');
              return;
          }
      } catch(e) { //no webgl at all =(
          alert('error : you are not compatible with WebGL at all');
          return;
      } 

    }

    //disable dithering :
    GL.disable(GL.DITHER);

    //CREATE THE RENDERING SHADER PROGRAM :
    //declare shader sources as string
    var shaderVertexSource="attribute vec2 position;\n"
      +"void main(void){\n"
      +"gl_Position=vec4(position, 0., 1.);\n"
      +"}";

    //rendering shader juste apply a colorMap to display the heat scalar value
    //the colormap function comes from https://github.com/kbinani/glsl-colormap
    //it encodes the IDL_Rainbow colorMap
    var shaderFragmentSourceRendering="precision lowp float;\n"
      +"uniform vec2 resolution;\n"
      +"uniform sampler2D samplerTexture;\n"

      //begin code from https://github.com/kbinani/glsl-colormap
      +"float colormap_red(float x) {\n"
      +"  if (x < 100.0) {\n"
      +"      return (-9.55123422981038E-02 * x + 5.86981763554179E+00) * x - 3.13964093701986E+00;\n"
      +"  } else {\n"
      +"      return 5.25591836734694E+00 * x - 8.32322857142857E+02;\n"
      +"  }\n"
      +"}\n"
      +"float colormap_green(float x) {\n"
      +"  if (x < 150.0) {\n"
      +"      return 5.24448979591837E+00 * x - 3.20842448979592E+02;\n"
      +"  } else {\n"
      +"      return -5.25673469387755E+00 * x + 1.34195877551020E+03;\n"
      +"  }\n"
      +"}\n"
      +"float colormap_blue(float x) {\n"
      +"  if (x < 80.0) {\n"
      +"      return 4.59774436090226E+00 * x - 2.26315789473684E+00;\n"
      +"  } else {\n"
      +"      return -5.25112244897959E+00 * x + 8.30385102040816E+02;\n"
      +"  }\n"
      +"}\n"
      +"vec4 colormap(float x) {\n"
      +"  float t = x * 255.0;\n"
      +"  float r = clamp(colormap_red(t) / 255.0, 0.0, 1.0);\n"
      +"  float g = clamp(colormap_green(t) / 255.0, 0.0, 1.0);\n"
      +"  float b = clamp(colormap_blue(t) / 255.0, 0.0, 1.0);\n"
      +"  return vec4(r, g, b, 1.0);\n"
      +"}\n"
      //end code from https://github.com/kbinani/glsl-colormap

      +"void main(void){\n"
      +"vec2 uv=gl_FragCoord.xy/resolution;\n"  //texture UV coordinates
      +"vec4 color=texture2D(samplerTexture, uv);\n" //fetch texture color. heat is stored in red channel
      +"gl_FragColor=colormap(color.r/100.);\n"
      +"}";

    //build rendering shader program :
    var shaderProgramRendering = build_shaderProgram(shaderVertexSource, shaderFragmentSourceRendering, 'RENDERING');
    //link attributes :
    var _positionAttributePointer = GL.getAttribLocation(shaderProgramRendering, 'position');
    GL.enableVertexAttribArray(_positionAttributePointer);
    create_andBindVBOs(_positionAttributePointer);

    //link uniforms :
    var _resolutionRenderingUniform = GL.getUniformLocation(shaderProgramRendering, 'resolution');
    var _samplerTextureRenderingUniform = GL.getUniformLocation(shaderProgramRendering, 'samplerTexture');


    //RENDER TO TEXTURE INITIALIZATION :
    //initialize and bind the FBO
    var rttFbo=GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, rttFbo);

    //instantiate the textures :
    var data0=new Float32Array(SETTINGS.simuSize*SETTINGS.simuSize*4);
    //set all temperatures values to 0°C
    for (var i=0; i<data0.length/4.; ++i){
        data0[i*4]=0;
    }

    //init a square of SETTINGS.simuSize/4 wide at the center of the texture with 1
    var sMin=Math.round(SETTINGS.simuSize/2-SETTINGS.simuSize/4);
    var sMax=Math.round(SETTINGS.simuSize/2+SETTINGS.simuSize/4);
    for (var y=sMin; y<sMax; ++y){
        for (var x=sMin; x<sMax; ++x){
            data0[(y*SETTINGS.simuSize+x)*4]=100; //temperature in celsius degrees
        }
    }

    var dataTextures=[
        create_rttTexture(SETTINGS.simuSize, SETTINGS.simuSize, data0),
        create_rttTexture(SETTINGS.simuSize, SETTINGS.simuSize, data0)
    ];

    //build the render to texture compute shader program :
    //it implements the Heat equation (https://en.wikipedia.org/wiki/Heat_equation)
    //using the finite element method : each texel is an element (https://en.wikipedia.org/wiki/Finite_element_method)
    //the texture pixel format is :
    //  RED : heat value
    //  GREEN, BLUE : spatial gradient of the heat
    //  ALPHA : unused
    //We only consider 2 dimensions (we drop the Z dimension)
    //We use a discrete Isotropic 3x3 Image Gradient Operator (Sobel operator) to approx the gradients
    //(see https://en.wikipedia.org/wiki/Sobel_operator)
    var shaderFragmentSourceComputing="precision highp float;\n"
      +"uniform vec2 resolution;\n"
      +"uniform sampler2D samplerTexture;\n"
      +"const float DT=1.; //time step in seconds\n"
      +"const float ALPHA=2.3e-5; //thermal diffusivity iron in m²/s\n"
      +"const float DS=0.01; //size in meters of 1 simulation unit\n"

      +"void main(void){\n"
      +"vec2 uv=gl_FragCoord.xy/resolution;\n"
      +"vec2 duv=1./resolution;\n" //distance between 2 texels

      +"//extract current heat from the texture :\n"
      +"float heat=texture2D(samplerTexture, uv).r;\n"
      
      +"//compute spatial derivative of heat (R) and gradient of gradient of heat = laplacian (GB) :\n"
      +"vec2 gradientX=texture2D(samplerTexture, uv+duv*vec2(-1.,-1.)).rg\n"
      +"    +   2.*texture2D(samplerTexture, uv+duv*vec2(-1.,0.)).rg\n"
      +"    +    texture2D(samplerTexture, uv+duv*vec2(-1.,1.)).rg\n"
      +"    -    texture2D(samplerTexture, uv+duv*vec2(1.,-1.)).rg\n"
      +"    - 2.*texture2D(samplerTexture, uv+duv*vec2(1.,0.)).rg\n"
      +"    -    texture2D(samplerTexture, uv+duv*vec2(1.,1.)).rg;\n"
      +"vec2 gradientY=texture2D(samplerTexture, uv+duv*vec2(-1.,-1.)).rb\n"
      +"    + 2.*texture2D(samplerTexture, uv+duv*vec2(0.,-1.)).rb\n"
      +"    +    texture2D(samplerTexture, uv+duv*vec2(1.,-1.)).rb\n"
      +"    -    texture2D(samplerTexture, uv+duv*vec2(-1.,1.)).rb\n"
      +"    - 2.*texture2D(samplerTexture, uv+duv*vec2(0.,1.)).rb\n"
      +"    -    texture2D(samplerTexture, uv+duv*vec2(1.,1.)).rb;\n"
      +"gradientX/=8.*DS; //take account of spatial scale\n"
      +"gradientY/=8.*DS;\n"

      +"vec2 heatGradientUpdated=vec2(gradientX.r, gradientY.r);\n"
      +"float laplacian=gradientX.g+gradientY.g;\n"

       +"//use heat equation to update the heat using Euler approximation :\n"
      +"float heatUpdated=heat + DT*ALPHA*laplacian;\n"

      +"gl_FragColor=vec4(heatUpdated, heatGradientUpdated, laplacian);\n"
      +"}";
    //build rendering shader program :
    var shaderProgramComputing = build_shaderProgram(shaderVertexSource, shaderFragmentSourceComputing, 'COMPUTING');
    //link uniforms :
    var _resolutionComputingUniform = GL.getUniformLocation(shaderProgramComputing, "resolution");
    var _samplerTextureComputingUniform = GL.getUniformLocation(shaderProgramComputing, 'samplerTexture')


    //COMPUTING TIME !
    GL.useProgram(shaderProgramComputing);
    GL.viewport(0,0,SETTINGS.simuSize,SETTINGS.simuSize);
    GL.uniform2f(_resolutionComputingUniform, SETTINGS.simuSize, SETTINGS.simuSize);
    GL.uniform1i(_samplerTextureComputingUniform, 0);
    GL.activeTexture(GL.TEXTURE0);

    //computing loop
    for (var i=0; i<SETTINGS.nIterations; ++i){
        GL.bindTexture(GL.TEXTURE_2D, dataTextures[0]);
        GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, dataTextures[1], 0);
        GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
        dataTextures.reverse();
        GL.finish();
    }
    
    //RENDERING TIME !
    //come back to the default FBO (displayed on the canvas) :
    GL.bindFramebuffer(GL.FRAMEBUFFER, null); 
    GL.useProgram(shaderProgramRendering);
    GL.uniform1i(_samplerTextureRenderingUniform, 0);
    GL.viewport(0,0,myCanvas.width, myCanvas.height);
    GL.uniform2f(_resolutionRenderingUniform, myCanvas.width, myCanvas.height);
    //trigger the rendering :
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    GL.flush();

} //end main()
