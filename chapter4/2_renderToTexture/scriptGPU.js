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

//parameters
var SETTINGS={
    simuSize: 256,
    nIterations: 2000
};

function main_GPU(){

    // CREATE WEBGL CONTEXT :
    var myCanvas=document.getElementById('myWebGLCanvas');
    var GL;
    try {
      GL=myCanvas.getContext('webgl', {antialias: false, depth: false});
    } catch(e) {
      alert('You are not WebGL compatible :(');
    }


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


    //CREATE THE RENDERING SHADER PROGRAM :
    //declare shader sources as string
    var shaderVertexSource="attribute vec2 position;\n"
      +"void main(void){\n"
      +"gl_Position=vec4(position, 0., 1.);\n"
      +"}";
    var shaderFragmentSourceRendering="precision highp float;\n"
      +"uniform vec2 resolution;\n"
      +"uniform sampler2D samplerTexture;\n"
      +"void main(void){\n"
      +"vec2 uv=gl_FragCoord.xy/resolution;\n"  //texture UV coordinates
      +"vec4 color=texture2D(samplerTexture, uv);\n" //fetch texture color
      +"gl_FragColor=vec4(color.r*vec3(1.,1.,0.) ,1.);\n"
      +"}";

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

    //build rendering shader program :
    var shaderProgramRendering = build_shaderProgram(shaderVertexSource, shaderFragmentSourceRendering, 'RENDERING');
    //link attributes :
    var _positionAttributePointer = GL.getAttribLocation(shaderProgramRendering, 'position');
    GL.enableVertexAttribArray(_positionAttributePointer);
    //link uniforms :
    var _resolutionRenderingUniform = GL.getUniformLocation(shaderProgramRendering, 'resolution');
    var _samplerTextureRenderingUniform = GL.getUniformLocation(shaderProgramRendering, 'samplerTexture');


    //BIND VBOs
    GL.bindBuffer(GL.ARRAY_BUFFER, quadVerticesVBO);
    GL.vertexAttribPointer(_positionAttributePointer, 2, GL.FLOAT, false, 8,0);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, quadIndicesVBO);


    //RENDER TO TEXTURE INITIALIZATION :
    //initialize and bind the FBO
    var rttFbo=GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, rttFbo);

    //instantiate the textures :
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
        GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, height, 0, GL.RGBA, GL.UNSIGNED_BYTE, data);
        return texture;
    }
    var data0=new Uint8Array(SETTINGS.simuSize*SETTINGS.simuSize*4);
    //randomly init cells live or dead
    for (var i=0; i<SETTINGS.simuSize*SETTINGS.simuSize; ++i){
        data0[i*4]=(Math.random()>0.5)?255:0;
    }
    //uncomment this code chunk to get the illustration of the book :
    //init a square of SETTINGS.simuSize/4 wide at the center of the texture with 1
    /* data0=new Uint8Array(SETTINGS.simuSize*SETTINGS.simuSize*4); //reset all values to 0
    var sMin=Math.round(SETTINGS.simuSize/2-SETTINGS.simuSize/4);
    var sMax=Math.round(SETTINGS.simuSize/2+SETTINGS.simuSize/4);
    for (var y=sMin; y<sMax; ++y){
        for (var x=sMin; x<sMax; ++x){
            data0[(y*SETTINGS.simuSize+x)*4]=255;
        }
    }*/

    var dataTextures=[
        create_rttTexture(SETTINGS.simuSize, SETTINGS.simuSize, data0),
        create_rttTexture(SETTINGS.simuSize, SETTINGS.simuSize, data0)
    ];

    //build the render to texture compute shader program :
    //note : the vertex shader is the same
    //it implements the Conway game of life (https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) :
    // each texel represents a cell
    // the cell is alive if its RED component = 1, dead if = 0
    // we look at the 8 neighboors of a cell (Moore neighborhood) :
    //   * if there are exactly 3 alive cell among the neighbors, this cell is always alive (born)
    //   * if there are 2 cells among the neighbors, its state is unchanged (survive)
    //   * otherwise it dies
    var shaderFragmentSourceComputing="precision highp float;\n"
      +"uniform vec2 resolution;\n"
      +"uniform sampler2D samplerTexture;\n"
      +"void main(void){\n"
      +"vec2 uv=gl_FragCoord.xy/resolution;\n"
      +"vec2 duv=1./resolution;\n" //distance between 2 texels
      +"float cellState=texture2D(samplerTexture, uv).r;\n"
      +"float nNeighborsAlive=texture2D(samplerTexture, uv+duv*vec2(-1.,-1.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(0.,-1.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(1.,-1.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(1.,0.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(1.,1.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(0.,1.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(-1.,1.)).r\n"
      +"    + texture2D(samplerTexture, uv+duv*vec2(-1.,0.)).r;\n"
      +"if (nNeighborsAlive==3.0){\n"
      +"  cellState=1.0;\n" //born
      +"} else if (nNeighborsAlive<=1.0 || nNeighborsAlive>=4.0){\n"
      +"  cellState=0.0;\n" //die
      +"};\n"
      +"gl_FragColor=vec4(cellState, 0., 0.,1.);\n"
      +"}";
    //build rendering shader program :
    var shaderProgramComputing = build_shaderProgram(shaderVertexSource, shaderFragmentSourceComputing, 'COMPUTING');
    //the rendering vertex shader is the same so attributes have the same name, number and dimension than the rendering shader program
    //so we do not need to link and enable them again
    //link uniforms :
    var _resolutionComputingUniform = GL.getUniformLocation(shaderProgramComputing, "resolution");
    var _samplerTextureComputingUniform = GL.getUniformLocation(shaderProgramComputing, 'samplerTexture')


    //COMPUTING TIME !
    GL.useProgram(shaderProgramComputing);
    GL.viewport(0,0,SETTINGS.simuSize,SETTINGS.simuSize);
    GL.uniform2f(_resolutionComputingUniform, SETTINGS.simuSize, SETTINGS.simuSize);
    GL.uniform1i(_samplerTextureComputingUniform, 0);
    //next bound texture will be bound on sampler 0 :
    GL.activeTexture(GL.TEXTURE0);

    //computing loop
    var tStart=performance.now();
    for (var i=0; i<SETTINGS.nIterations; ++i){
        GL.bindTexture(GL.TEXTURE_2D, dataTextures[0]);
        GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, dataTextures[1], 0);
        GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
        dataTextures.reverse();
    }
    GL.finish(); //force synchronization GPU/CPU. For benchmarking only !
    var dt=performance.now()-tStart;
    console.log('DURATION OF THE GPU SIMULATION (in ms) : ', dt);

    //RENDERING TIME !
    //come back to the default FBO (displayed on the canvas) :
    GL.bindFramebuffer(GL.FRAMEBUFFER, null); 
    //rendering :
    GL.useProgram(shaderProgramRendering);
    //set _samplerTextureRenderingUniform to sampler 0 :
    GL.uniform1i(_samplerTextureRenderingUniform, 0);
    //update GLSL "resolution" value in the fragment shader :
    GL.viewport(0,0,myCanvas.width, myCanvas.height);
    //update GLSL "resolution" value in the fragment shader :
    GL.uniform2f(_resolutionRenderingUniform, myCanvas.width, myCanvas.height);
    //trigger the rendering :
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    GL.flush();

} //end main_GPU()
