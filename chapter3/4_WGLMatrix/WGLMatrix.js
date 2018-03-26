/*
Linear algebra WebGL minimalist library
*/

//closure :
var WGLMatrix=(function(){

	//private variables :
	var GL, //webgl context
		FLOATPIXELTYPE, //GL.FLOAT or HALF_FLOAT
		ISWEBGL2, //boolean, if WebGL1 or 2
		SHADERPROGRAMSDICT={},
		ISINITIALIZED=false; //shader program dictionnary

	//private functions :
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

	//specific shaders for matrix computation 
	function build_matrixShaderProgram(shaderSourceArray, id, nInputMatrices){
		var shaderSourceHeaderArray=['precision highp float;', 'uniform vec2 resolution;'];
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
		var uniformsInputMatrices=[];
		for (var i=0; i<nInputMatrices; ++i){
			 uniformsInputMatrices.push(GL.getUniformLocation(glShaderProgram, 'samplerTexture'+i.toString()));
		}

		//save the shader program to the dictionnary
		SHADERPROGRAMSDICT[id]={
			uniformResolution: GL.getUniformLocation(glShaderProgram, 'resolution'),
			uniformsInputMatrices: uniformsInputMatrices,
			shaderProgram: glShaderProgram
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

	function process_matrixOperation(shaderProgramId, matrixOperators, matrixResult){
		GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, matrixResult._glTexture, 0);
		GL.useProgram(SHADERPROGRAMSDICT[shaderProgramId].shaderProgram);
		GL.viewport(0,0,matrixResult.shape[1],matrixResult.shape[0]);
		GL.uniform2f(SHADERPROGRAMSDICT[shaderProgramId].uniformResolution, matrixResult.shape[1], matrixResult.shape[0]);
		matrixOperators.forEach(function(mo, moIndex){
			GL.activeTexture([GL.TEXTURE0, GL.TEXTURE1, GL.TEXTURE2, GL.TEXTURE3][moIndex]);
			GL.bindTexture(GL.TEXTURE_2D, mo._glTexture);
		});
		GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
		return matrixResult; //to be chainable
	};

	function compile_matrixAddShaderProgram(){
		var shaderSource=[
		'void main(void){',
		'vec2 uv=gl_FragCoord.xy/resolution;',
  		'vec4 matAValue=texture2D(samplerTexture0, uv);',
  		'vec4 matBValue=texture2D(samplerTexture1, uv);',
  		'gl_FragColor=matAValue+matBValue;',
  		'}'];
		build_matrixShaderProgram(shaderSource, 'ADD', 2);
	};

	function compile_matrixReadShaderProgram(){
		var shaderSource=[
		
		];
		build_matrixShaderProgram(shaderSource, 'READ', 1);
	};

	//PUBLIC STATIC METHODS :
	var that={
		init: function(){
			if (ISINITIALIZED){
				console.log('ERROR : already initialized');
				return false;
			}

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

			//ADD SHADERPROGRAMS
			compile_matrixAddShaderProgram();
			compile_matrixReadShaderProgram();

			//RENDER TO TEXTURE INITIALIZATION :
			var rttFbo=GL.createFramebuffer();
			GL.bindFramebuffer(GL.FRAMEBUFFER, rttFbo);

			/*
			//come back to the default FBO (displayed on the canvas) :
			GL.bindFramebuffer(GL.FRAMEBUFFER, null); 
			GL.useProgram(shaderProgramRendering);
			GL.uniform1i(_samplerTextureRenderingUniform, 0);
			GL.viewport(0,0,myCanvas.width, myCanvas.height);
			GL.uniform2f(_resolutionRenderingUniform, myCanvas.width, myCanvas.height);
			//trigger the rendering :
			GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
			GL.flush();*/
			ISINITIALIZED=true;
			return true;
		},//end init()


		Matrix: function(nRows, nCols, flattenDataR, flattenDataG, flattenDataB, flattenDataA){
			if (!ISINITIALIZED){
				if (!that.init()){
					return false;
				};
			}

			if (!flattenDataG) var flattenDataG=flattenDataR;
			if (!flattenDataB) var flattenDataB=flattenDataR;
			if (!flattenDataA) var flattenDataA=flattenDataR;
			
			var flattenDataRGBA=new Float32Array(nRows*nCols*4);
			var x,y,n;
			for (y=0; y<nRows; ++y){
				for (x=0; x<nCols; ++x){
					n=y*nCols+x;
					flattenDataRGBA[n*4]=flattenDataR[n]; //red
					flattenDataRGBA[n*4]=flattenDataG[n]; //green
					flattenDataRGBA[n*4]=flattenDataB[n]; //blue
					flattenDataRGBA[n*4]=flattenDataA[n]; //alpha
				}
			}

			//DYNAMIC ATTRIBUTES :
			this._glTexture=create_matrixTexture(nCols, nRows, flattenDataRGBA);
			this.shape=[nRows, nCols];

			//DYNAMIC METHODS :
			//add matrixB to this and store result into matrixR
			this.add=function(matrixB, matrixR){
				return process_matrixOperation('ADD', [matrixB], matrixR);
			}

			var buffers=[];
			for (var i=0; i<4; ++i){ //loop on RGBA channels
				buffers.push(new Float32Array(nRows*nCols));
			}
			this.read=function(){

			}

			this.transpose=function(matrixR){

			}

			this.multiply=function(matrixB, matrixR){

			}

			this.fma=function(matrixB, matrixC, matrixR){

			}

			this.apply=function(funcName, matrixR){

			}
		}, //end Matrix constructor

		MatrixZero: function(nRows, nCols){
			var flattenData=new Float32Array(nRows*nCols);
			return new that.Matrix(nRows, nCols, flattenData);
		},

		MatrixIdentity: function(nRows){
			var flattenData=new Float32Array(nRows*nRows);
			for (var i=0; i<nRows; ++i){
				flattenData[i*nRows+i]=1.0;
			}
			return new that.Matrix(nRows, nRows, flattenData);
		}
	} //end that

	return that;

})(); //end WGLMatrix closure