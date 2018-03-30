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

function main(){

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


    //CREATE THE SHADER PROGRAM :
    //declare shader sources as string
    var shaderVertexSource="attribute vec2 position;\n"
      +"void main(void){\n"
      +"gl_Position=vec4(position, 0., 1.);\n"
      +"}";
    var shaderFragmentSource="precision highp float;\n"
      +"uniform vec2 resolution;\n"
      +"void main(void){\n"
      +"vec2 pixelPosition=gl_FragCoord.xy/resolution;\n"
      +"vec2 pixelPositionCentered=1.3*(pixelPosition*2.-vec2(1.55,1.));\n"
      +"vec2 z = pixelPositionCentered, newZ;\n"
      +"float j=0.;\n"
      +"for(int i=0; i<=200; i+=1) {\n"
      +"    newZ = pixelPositionCentered+vec2(z.x * z.x - z.y * z.y, 2. * z.y * z.x);\n"
      +"    if(length(newZ) > 2.) break;\n"
      +"    z=newZ; j+=1.;\n"
      +"}\n"
      +"vec3 color=step(j, 199.)*vec3(j/20., j*j/4000., 0.);\n"
      +"gl_FragColor = vec4(color,1.);\n"
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
    //compile both shader separately
    var shaderVertex=compile_shader(shaderVertexSource, GL.VERTEX_SHADER, "VERTEX");
    var shaderFragment=compile_shader(shaderFragmentSource, GL.FRAGMENT_SHADER, "FRAGMENT");

    var shaderProgram=GL.createProgram();
    GL.attachShader(shaderProgram, shaderVertex);
    GL.attachShader(shaderProgram, shaderFragment);

    //start the linking stage :
    GL.linkProgram(shaderProgram);

    //link attributes :
    var _positionAttributePointer = GL.getAttribLocation(shaderProgram, "position");
    GL.enableVertexAttribArray(_positionAttributePointer);

    //link uniforms :
    var _resolutionUniform = GL.getUniformLocation(shaderProgram, "resolution");


    //RENDERING TIME !
    //bind VBOs
    GL.bindBuffer(GL.ARRAY_BUFFER, quadVerticesVBO);
    GL.vertexAttribPointer(_positionAttributePointer, 2, GL.FLOAT, false, 8,0);
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, quadIndicesVBO);

    //rendering :
    GL.useProgram(shaderProgram);
    //update GLSL "resolution" value in the fragment shader :
    GL.viewport(0,0,myCanvas.width, myCanvas.height);
    //update GLSL "resolution" value in the fragment shader :
    GL.uniform2f(_resolutionUniform, myCanvas.width, myCanvas.height);
    //trigger the rendering :
    GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
    GL.flush();

} //end main()
