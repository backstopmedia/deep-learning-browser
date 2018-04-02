/**
* WGLMatrix v0.3
* Linear algebra WebGL minimalist library
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
This is based on the previous example (simple test of Matrix operations)
We have added few simple methods to implement the MNIST learning demo
*/

//strict mode : there is no small optimization !
"use strict";

//closure :
var WGLMatrix=(function(){

    //private variables :
    var GL, //webgl context
        FLOATPIXELTYPE, //GL.FLOAT or HALF_FLOAT
        ISWEBGL2, //boolean, if WebGL1 or 2
        RTTFBO, //FBO used for render to texture
        SHADERPROGRAMSDICT={}, //dictionnary with all shaderPrograms
        ISINITIALIZED=false; //shader program dictionnary

    //private functions :
    //SOME BASIC MATH FUNCTIONS :
    function get_randomNormal(){ // Standard Normal variate using Box-Muller transform
        var u = 0, v = 0;
        while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
        while(v === 0) v = Math.random();
        return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    }

    //WEBGL GENERAL FUNCTIONS :
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
        console.log('Buggy shader source : \n', source);
        return false;
      }
      return shader;
    };

    //helper function to build the shader program :
    function build_shaderProgram(shaderFragmentSource, id) {
        var shaderVertexSource="attribute vec2 position;\n"
              +"void main(void){\n"
              +"gl_Position=vec4(position, 0., 1.);\n"
              +"}";

        //compile both shader separately
        var shaderVertex=compile_shader(shaderVertexSource, GL.VERTEX_SHADER, "VERTEX "+id);
        var shaderFragment=compile_shader(shaderFragmentSource, GL.FRAGMENT_SHADER, "FRAGMENT "+id);

        var shaderProgram=GL.createProgram();
        GL.attachShader(shaderProgram, shaderVertex);
        GL.attachShader(shaderProgram, shaderFragment);

        //start the linking stage :
        GL.linkProgram(shaderProgram);

        return shaderProgram;
    } //end build_shaderProgram

    function create_andBindVBOs(positionAttributePointer){
        // CREATE THE VERTEX BUFFER OBJECTS :
        //declare vertices and indices of a triangle
        //which fill the whole viewport and overflows
        var triVertices = new Float32Array([
          -1,-1,
          3,-1,
          -1,3
        ]);
        var triIndices = new Uint16Array([
          0,1,2 //first triangle
        ]);

        //send vertices to the GPU :
        var triVerticesVBO= GL.createBuffer();
        GL.bindBuffer(GL.ARRAY_BUFFER, triVerticesVBO);
        GL.bufferData(GL.ARRAY_BUFFER, triVertices, GL.STATIC_DRAW);

        //send indices to the GPU :
        var triIndicesVBO= GL.createBuffer();
        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, triIndicesVBO);
        GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, triIndices, GL.STATIC_DRAW);

        //BIND VBOs
        GL.bindBuffer(GL.ARRAY_BUFFER, triVerticesVBO);
        GL.vertexAttribPointer(positionAttributePointer, 2, GL.FLOAT, false, 8,0);
        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, triIndicesVBO);    
    }

    //helper function to create a texture
    function create_matrixTexture(width, height, data){
        var texture=GL.createTexture();
        GL.bindTexture(GL.TEXTURE_2D, texture);
        //texture filtering : always pick the nearest pixel from the texture UV coordinates :
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);

        //does not repeat texture along axis
        //(otherwise may throw errors if dimensions of the texture are not power of 2) :
        GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE );
        GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE );
        
        if (data instanceof Uint8Array){ //8 bits precision
            GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, height, 0, GL.RGBA, GL.UNSIGNED_BYTE, data);
        } else if (FLOATPIXELTYPE===GL.FLOAT){ //32 bit precision
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

    //GPU MATRIX COMPUTATION SPECIFIC FUNCTIONS :
    //specific shaders for matrix computation 
    function build_matrixShaderProgram(shaderSourceArray, id, nInputMatrices, uniformsGLSLnames, precision){
        var precision=(precision)?precision:'highp';
        var shaderSourceHeaderArray=['precision '+precision+' float;', 'uniform vec2 resolution;'];
        for (var i=0; i<nInputMatrices; ++i){
            shaderSourceHeaderArray.push('uniform sampler2D samplerTexture'+i.toString()+';');
        }
        var shaderSource=shaderSourceHeaderArray.concat(shaderSourceArray).join('\n');
        var glShaderProgram=build_shaderProgram(shaderSource, id);

        //if this is the first compiled shader program, enable the position attribute
        //(all the others have the same attributes so we don't need to redo this again)
        if (Object.keys(SHADERPROGRAMSDICT).length===0){
            var positionAttributePointer = GL.getAttribLocation(glShaderProgram, 'position');
            GL.enableVertexAttribArray(positionAttributePointer);
            create_andBindVBOs(positionAttributePointer);
        }

        //link uniforms
        for (var i=0, uniformsInputMatrices=[]; i<nInputMatrices; ++i){
             uniformsInputMatrices.push(GL.getUniformLocation(glShaderProgram, 'samplerTexture'+i.toString()));
        }
        var uniformsDict={};
        if (uniformsGLSLnames){ //uniforms other than inputMatrix and resolution
            uniformsGLSLnames.forEach(function(uniformGLSLname){
                uniformsDict[uniformGLSLname]=GL.getUniformLocation(glShaderProgram, uniformGLSLname);
            });
        }

        //save the shader program to the dictionnary
        SHADERPROGRAMSDICT[id]={
            uniformResolution: GL.getUniformLocation(glShaderProgram, 'resolution'),
            uniformsInputMatrices: uniformsInputMatrices,
            shaderProgram: glShaderProgram,
            uniforms: uniformsDict
        };

        //affect texture samplers channel indices
        GL.useProgram(glShaderProgram);
        uniformsInputMatrices.forEach(function(uniformMat, uniformMatIndex){
            GL.uniform1i(uniformMat, uniformMatIndex);
        });
    }; //end build_matrixShaderProgram()

    function is_matrixShaderProgram(id){
        return (typeof(SHADERPROGRAMSDICT[id])!=='undefined');
    }

    //used for hidden (RTT) matrix operations : ADD, MULTIPLY, ...
    function process_matrixOperation(shaderProgramId, matrixOperators, matrixResult, onBeforeRender){
        GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, matrixResult._glTexture, 0);
        GL.viewport(0,0,matrixResult.shape[1],matrixResult.shape[0]);
        prepare_matrixOperation(shaderProgramId, matrixOperators, matrixResult.shape[1], matrixResult.shape[0]);
        if (onBeforeRender){
            onBeforeRender();
        }
        fill_viewport();
        return matrixResult; //to be chainable
    };

    //used both by process_matrixOperation and READ matrix (render on default FBO + readPixels() ):
    function prepare_matrixOperation(shaderProgramId, matrixOperators, width, height){
        GL.useProgram(SHADERPROGRAMSDICT[shaderProgramId].shaderProgram);
        GL.uniform2f(SHADERPROGRAMSDICT[shaderProgramId].uniformResolution, width, height);
        matrixOperators.forEach(function(mo, moIndex){
            GL.activeTexture([GL.TEXTURE0, GL.TEXTURE1, GL.TEXTURE2, GL.TEXTURE3][moIndex]);
            GL.bindTexture(GL.TEXTURE_2D, mo._glTexture);
        });
    }

    function get_shaderUniform(shaderProgramId, uniformGLSLname){
        return SHADERPROGRAMSDICT[shaderProgramId].uniforms[uniformGLSLname];
    }

    function fill_viewport(){ //2 triangles VBOs are bound once and for all. Only have to drawElements
        GL.drawElements(GL.TRIANGLES, 3, GL.UNSIGNED_SHORT, 0);
    }

    function compile_matrixElementWise2ShaderProgram(glslOperatorCode, id){
        var shaderSource=[
        'void main(void){',
        'vec2 uv=gl_FragCoord.xy/resolution;',
          'vec4 matAValue=texture2D(samplerTexture0, uv);',
          'vec4 matBValue=texture2D(samplerTexture1, uv);',
          'gl_FragColor=matAValue'+glslOperatorCode+'matBValue;',
          '}'];
        build_matrixShaderProgram(shaderSource, id, 2);
    }
    
    function compile_matrixReadShaderProgram(){
        //Renders the channel of a float texture into an unsigned byte RGBA color
        //which can be read using GL.readPixels()
        //shader from :
        //http://stackoverflow.com/questions/17981163/webgl-read-pixels-from-floating-point-render-target
        var shaderSource=[
            'uniform vec4 colorChannelMask;',
            'uniform vec2 uvOffset;',

            'float shift_right (float v, float amt) {',
            '    v = floor(v) + 0.5;',
            '    return floor(v / exp2(amt));',
            '}',
            'float shift_left (float v, float amt) {',
            '    return floor(v * exp2(amt) + 0.5);', 
            '}',
            'float mask_last (float v, float bits) {', 
            '    return mod(v, shift_left(1.0, bits));',
            '}',
            'float extract_bits (float num, float from, float to) {',
            '    from = floor(from + 0.5); to = floor(to + 0.5);',
            '    return mask_last(shift_right(num, from), to - from);', 
            '}',

            'vec4 encode_float (float val) {',
            '    if (val == 0.0) return vec4(0.0, 0.0, 0.0, 0.0);',
            '    float sign = val > 0.0 ? 0.0 : 1.0;',
            '    val = abs(val);',
            '    float exponent = floor(log2(val));',
            '    float biased_exponent = exponent + 127.0;',
            '    float fraction = ((val / exp2(exponent)) - 1.0) * 8388608.0;',
            '    float t = biased_exponent / 2.0;',
            '    float last_bit_of_biased_exponent = fract(t) * 2.0;',
            '    float remaining_bits_of_biased_exponent = floor(t);',
            '    float byte4 = extract_bits(fraction, 0.0, 8.0) / 255.0;', 
            '    float byte3 = extract_bits(fraction, 8.0, 16.0) / 255.0;',
            '    float byte2 = (last_bit_of_biased_exponent * 128.0 + extract_bits(fraction, 16.0, 23.0)) / 255.0;',
            '    float byte1 = (sign * 128.0 + remaining_bits_of_biased_exponent) / 255.0;',
            '    return vec4(byte4, byte3, byte2, byte1);',
            '}',

            'void main(void) {',
            '    vec2 uv=(gl_FragCoord.xy+uvOffset)/resolution;',
            '    float a=dot(texture2D(samplerTexture0, uv), colorChannelMask);',
            '    gl_FragColor=encode_float(a);',
            '}'
        ];
        build_matrixShaderProgram(shaderSource, 'READ', 1, ['colorChannelMask', 'uvOffset']);
    };

    function compile_matrixTransposeShaderProgram(){
        var shaderSource=[
        'void main(void){',
        'vec2 uv=gl_FragCoord.xy/resolution;',
          'gl_FragColor=texture2D(samplerTexture0, uv.yx);',
          '}'];
        build_matrixShaderProgram(shaderSource, 'TRANSPOSE', 1);
    }

    function compile_matrixMultiplyShaderProgram(commonDim){
        var commonDimFloat=commonDim.toFixed(1);
        var shaderSourcePrefix=[
        'const vec2 DU=vec2(1./'+commonDimFloat+', 0.);', //vector between 2 consecutive texels of first factor
        'const vec2 DV=vec2(0., 1./'+commonDimFloat+');', //vector between 2 consecutive texels of second factor
        'void main(void){',
        '  vec2 uv=gl_FragCoord.xy/resolution;',
        '  vec2 uvu=uv*vec2(1.,0.);',
        '  vec2 uvv=uv*vec2(0.,1.);',
        '  vec4 result=vec4(0.,0.,0.,0.);',
        '  for (float i=0.0; i<'+commonDimFloat+'; i+=1.0){',
        '    result+=texture2D(samplerTexture0, uvv+(i+0.5)*DU) * texture2D(samplerTexture1, uvu+(i+0.5)*DV);',
        '  }'];

        var shaderSourceSuffix=[
        '  gl_FragColor=result;',
        '}'];

        var shaderSourceMult=shaderSourcePrefix.concat(shaderSourceSuffix);
        var shaderSourceFMA=shaderSourcePrefix.concat(['result+=texture2D(samplerTexture2, uv);'], shaderSourceSuffix);
        build_matrixShaderProgram(shaderSourceMult, 'MULTIPLY'+commonDim.toString(), 2);
        build_matrixShaderProgram(shaderSourceFMA, 'FMA'+commonDim.toString(), 3);
    }

    function compile_matrixMultiplyScalarShaderProgram(){
        var shaderSource=[
        'uniform float scalar;',
        'void main(void){',
        'vec2 uv=gl_FragCoord.xy/resolution;',
          'gl_FragColor=texture2D(samplerTexture0, uv)*scalar;',
          '}'];
        build_matrixShaderProgram(shaderSource, 'MULTIPLYSCALAR', 1, ['scalar']);
    }

    function compile_matrixCopyShaderProgram(){
        var shaderSource=[
        'void main(void){',
        'vec2 uv=gl_FragCoord.xy/resolution;',
          'gl_FragColor=texture2D(samplerTexture0, uv);',
          '}'];
        build_matrixShaderProgram(shaderSource, 'COPY', 1);
    }

    function compile_matrixSetShaderProgram(){
        var shaderSource=[
        'uniform float val;',
        'void main(void){',
        'gl_FragColor=vec4(1.,1.,1.,1.)*val;',
          '}'];
        build_matrixShaderProgram(shaderSource, 'SET', 0, ['val']);
    }

    function compile_matrixMultiplexRGBAShaderProgram(){
        var shaderSource=[
        'void main(void){',
        'vec2 uv=gl_FragCoord.xy/resolution;',
          'gl_FragColor=vec4(texture2D(samplerTexture0, uv).r, texture2D(samplerTexture1, uv).r, texture2D(samplerTexture2, uv).r, texture2D(samplerTexture3, uv).r);',
          '}'];
          build_matrixShaderProgram(shaderSource, 'MULTIPLEXRGBA', 4, [], 'lowp');
    }

    function compile_matrixSumRGBAShaderProgram(){
        var shaderSource=[
        'const vec4 ONE4=vec4(1.,1.,1.,1.);',
        'void main(void){',
        'vec2 uv=gl_FragCoord.xy/resolution;',
        'float sumRGBA=dot(texture2D(samplerTexture0, uv), ONE4);',
          'gl_FragColor=sumRGBA*ONE4;',
          '}'];
          build_matrixShaderProgram(shaderSource, 'SUMRGBA', 1);
    }

    //PUBLIC STATIC METHODS AND INTANTIABLES OBJECTS :
    var that={
        init: function(){
            if (ISINITIALIZED){
                console.log('ERROR : already initialized');
                return false;
            }
            console.log('INFO : Init WGLMatrix...');

            //create the canvas (will be hidden and inserted to the DOM)
            var myCanvas=document.createElement('canvas');
            myCanvas.setAttribute('width', 512);
            myCanvas.setAttribute('height', 512);

            // CREATE WEBGL CONTEXT :
            var webglOptions={antialias: false, depth: false,
                    preserveDrawingBuffer: true //otherwise GL.readPixel may not work properly
                };
            
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
                      return false;
                  }
              } catch(e) { //no webgl at all =(
                  alert('error : you are not compatible with WebGL at all');
                  return false;
              }
            }

            GL.disable(GL.DITHER);

            //ADD SHADERPROGRAMS
            compile_matrixElementWise2ShaderProgram('+', 'ADD');
            compile_matrixElementWise2ShaderProgram('-', 'SUB');
            compile_matrixElementWise2ShaderProgram('*', 'HADAMARD'); //Hadamard product https://en.wikipedia.org/wiki/Hadamard_product_(matrices)
            compile_matrixReadShaderProgram();
            compile_matrixTransposeShaderProgram();
            compile_matrixMultiplyScalarShaderProgram();
            compile_matrixCopyShaderProgram();
            compile_matrixSetShaderProgram();
            compile_matrixMultiplexRGBAShaderProgram();
            compile_matrixSumRGBAShaderProgram();

            //RENDER TO TEXTURE INITIALIZATION :
            RTTFBO=GL.createFramebuffer();
            GL.bindFramebuffer(GL.FRAMEBUFFER, RTTFBO);

            ISINITIALIZED=true;
            return true;
        },//end init()

        addFunction: function(glslCode, funcName){
            var shaderId='FUNC'+funcName;
            var shaderSource=[
            'const vec4 ONE=vec4(1.,1.,1.,1.);',
            'void main(void){',
            'vec2 uv=gl_FragCoord.xy/resolution;',
              'vec4 x=texture2D(samplerTexture0, uv);',
              'vec4 y;',
              glslCode,
              'gl_FragColor=y;',
              '}'];
            build_matrixShaderProgram(shaderSource, shaderId, 1);
        },

        Matrix: function(nRows, nCols, flattenDataR, flattenDataG, flattenDataB, flattenDataA){
            if (!ISINITIALIZED){
                if (!that.init()){
                    return false;
                };
            }

            //take account of 8bits precision :
            this._isFloat=!(flattenDataR instanceof Uint8Array);
            
            //duplicate GBA channels from RED channel if not provided
            if (!flattenDataG) var flattenDataG=flattenDataR;
            if (!flattenDataB) var flattenDataB=flattenDataR;
            if (!flattenDataA) var flattenDataA=flattenDataR;
            
            //format matrix data to initialize the texture :
            var nElts=nRows*nCols;
            var flattenDataRGBA=(this._isFloat)?new Float32Array(nElts*4):new Uint8Array(nElts*4);
            var x,y,n;
            for (y=0; y<nRows; ++y){
                for (x=0; x<nCols; ++x){
                    n=y*nCols+x;
                    flattenDataRGBA[n*4]  =flattenDataR[n]; //red
                    flattenDataRGBA[n*4+1]=flattenDataG[n]; //green
                    flattenDataRGBA[n*4+2]=flattenDataB[n]; //blue
                    flattenDataRGBA[n*4+3]=flattenDataA[n]; //alpha
                }
            }
            var self=this;

            //DYNAMIC ATTRIBUTES :
            this._glTexture=create_matrixTexture(nCols, nRows, flattenDataRGBA);
            this.shape=[nRows, nCols];
            this.data0=[flattenDataR, flattenDataG, flattenDataB, flattenDataA];
            flattenDataRGBA=null; //to help the GC

            this.shapeEquals=function(matrixB){
                return (self.shape[0]===matrixB.shape[0] && self.shape[1]===matrixB.shape[1]);
            }

            //DYNAMIC METHODS :
            //add matrixB to this and store result into matrixR
            this.add=function(matrixB, matrixR){
                if (!self.shapeEquals(matrixB) || !self.shapeEquals(matrixR)){
                    throw 'cannot add : dimensions mismatch';
                }
                return process_matrixOperation('ADD', [self, matrixB], matrixR);
            }
            this.sub=function(matrixB, matrixR){
                if (!self.shapeEquals(matrixB) || !self.shapeEquals(matrixR)){
                    throw 'cannot sub : dimensions mismatch';
                }
                return process_matrixOperation('SUB', [self, matrixB], matrixR);
            }
            this.hadamard=function(matrixB, matrixR){
                if (!self.shapeEquals(matrixB) || !self.shapeEquals(matrixR)){
                    throw 'cannot hadamard : dimensions mismatch';
                }
                return process_matrixOperation('HADAMARD', [self, matrixB], matrixR);
            }

            var buffersByte=false, buffersFloat=[];
            this.read=function(){
                if (!this._isFloat){
                    throw '8bits matrix reading not implemented yet';
                }
                if (!buffersByte){
                    //instantiate buffers required by this.read() :
                    //we do this here to allocate memory only for matrices which are read
                    var n=nElts*4;
                    buffersByte=[new Uint8Array(n), new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)];
                    for (var i=0; i<4; ++i){ //loop on RGBA channels
                        buffersFloat.push(new Float32Array(buffersByte[i].buffer));
                    }
                }

                //come back to the default FBO (displayed on the canvas) :
                GL.bindFramebuffer(GL.FRAMEBUFFER, null); 
                prepare_matrixOperation('READ', [self], nCols, nRows);

                var colorChannelMasks=[
                    [1,0,0,0], //red
                    [0,1,0,0], //green
                    [0,0,1,0], //blue
                    [0,0,0,1]  //alpha
                ];

                //render each color channel (RGBA) into a separate viewport
                //for example the RED channel is rendered on a specific viewport and each RED value is packed into 4 RGBA 8bits components
                for (var i=0; i<4; ++i){ //loop over RGBA color channels
                    GL.viewport(0, nRows * i, nCols, nRows);
                    GL.uniform4fv(get_shaderUniform('READ', 'colorChannelMask'), colorChannelMasks[i]);
                    GL.uniform2f(get_shaderUniform('READ', 'uvOffset'), 0, -nRows * i);
                    fill_viewport();
                    GL.readPixels(0, nRows * i, nCols, nRows, GL.RGBA, GL.UNSIGNED_BYTE, buffersByte[i]);
                }

                //restore RTT fb
                GL.bindFramebuffer(GL.FRAMEBUFFER, RTTFBO);

                return buffersFloat;
            }

            this.setValue=function(val){
                return process_matrixOperation('SET', [], self, function(){
                    GL.uniform1f(get_shaderUniform('SET', 'val'), val);
                });
            }

            this.transpose=function(matrixR){
                if (nRows!==matrixR.shape[1] || nCols!==matrixR.shape[0]){
                    throw 'cannot transpose : dimensions mismatch';
                }
                return process_matrixOperation('TRANSPOSE', [self], matrixR);
            }

            this.multiply=function(matrixB, matrixR){
                if (nCols!==matrixB.shape[0]){
                    throw 'cannot multiply : dimensions mismatch';
                }
                var shaderId='MULTIPLY'+nCols.toString();
                if (!is_matrixShaderProgram(shaderId)){
                    compile_matrixMultiplyShaderProgram(nCols);
                }

                return process_matrixOperation(shaderId, [self, matrixB], matrixR);
            }

            this.fma=function(matrixB, matrixC, matrixR){
                if (nCols!==matrixB.shape[0] || !matrixC.shapeEquals(matrixR)){
                    throw 'cannot fma : dimensions mismatch';
                }
                var shaderId='FMA'+nCols.toString();
                if (!is_matrixShaderProgram(shaderId)){
                    compile_matrixMultiplyShaderProgram(nCols);
                }
                return process_matrixOperation(shaderId, [self, matrixB, matrixC], matrixR);
            }

            this.multiplyScalar=function(scalar, matrixR){
                if (!self.shapeEquals(matrixR)){
                    throw 'Cannot multiplyScalar : dimension mismatch';
                }
                return process_matrixOperation('MULTIPLYSCALAR', [self], matrixR, function(){
                    GL.uniform1f(get_shaderUniform('MULTIPLYSCALAR', 'scalar'), scalar);
                });
            }

            this.apply=function(funcName, matrixR){
                var shaderId='FUNC'+funcName;
                if (!is_matrixShaderProgram(shaderId)){
                    throw 'Cannot find function '+funcName+' . Plz add it using WGLMatrix.addFunction(...)';
                }
                if (!self.shapeEquals(matrixR)){
                    throw 'Cannot apply function : dimension mismatch';
                }
                return process_matrixOperation(shaderId, [self], matrixR);
            }

            this.copy=function(matrixR){
                if (!self.shapeEquals(matrixR)){
                    throw 'Cannot copy : dimension mismatch';
                }
                return process_matrixOperation('COPY', [self], matrixR);
            }

            this.multiplexRGBA=function(matrixGreen, matrixBlue, matrixAlpha, matrixR){ //this is the matrixRed
                return process_matrixOperation('MULTIPLEXRGBA', [self, matrixGreen, matrixBlue, matrixAlpha], matrixR);
            }
            this.sumRGBA=function(matrixR){
                return process_matrixOperation('SUMRGBA', [self], matrixR);
            }
            this.remove=function(){
                GL.deleteTexture(self._glTexture);
                self=null;
            }
        }, //end Matrix constructor

        MatrixConstant: function(nRows, nCols, value){
            var flattenData=new Float32Array(nRows*nCols);
            for (var i=0; i<flattenData.length; ++i){
                flattenData[i]=value;
            }
            return new that.Matrix(nRows, nCols, flattenData);
        },

        MatrixZero: function(nRows, nCols){
            var flattenData=new Float32Array(nRows*nCols);
            return new that.Matrix(nRows, nCols, flattenData);
        },

        MatrixZero8bits: function(nRows, nCols){
            var flattenData=new Uint8Array(nRows*nCols);
            return new that.Matrix(nRows, nCols, flattenData);
        },

        MatrixIdentity: function(nRows){
            for (var i=0, flattenData=new Float32Array(nRows*nRows); i<nRows; ++i){
                flattenData[i*nRows+i]=1.0;
            }
            return new that.Matrix(nRows, nRows, flattenData);
        },

        //fill a matrix with normal distribution law (sigma=1, mu=0)
        //analog to numpy.random.randn(nRows, nCols)
        MatrixRandN: function(nRows, nCols){
            var nElts=nRows*nCols*4;
            for (var i=0, flattenData=new Float32Array(nElts); i<nElts; ++i){
                flattenData[i]=get_randomNormal();
            }
            return new that.Matrix(nRows, nCols, flattenData);
        },

        //make sure all GPU operations are finished (before a breakpoint for example)
        finish: function(){
            GL.finish();
        }
    } //end that

    return that;
})(); //end WGLMatrix closure