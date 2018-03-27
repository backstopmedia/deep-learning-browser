/*
javascript equivalent of network.py :
https://github.com/mnielsen/neural-networks-and-deep-learning/blob/master/src/network.py

code explanation comments have been copied from network.py
and written by Michael Nielsen
*/ 

//closure :
var network=(function(){
	// transcode some numpy/python functions :
	function shuffleArray(a) { //shuffle array a
	    var j, x, i;
	    for (i = a.length - 1; i > 0; i--) {
	        j = Math.floor(Math.random() * (i + 1));
	        x = a[i];
	        a[i] = a[j];
	        a[j] = x;
	    }
	}


	var that={ //public methods and objects
		//Network constructor :
		Network: function(sizes){
			/*The list ``sizes`` contains the number of neurons in the
	        respective layers of the network.  For example, if the list
	        was [2, 3, 1] then it would be a three-layer network, with the
	        first layer containing 2 neurons, the second layer 3 neurons,
	        and the third layer 1 neuron.  The biases and weights for the
	        network are initialized randomly, using a Gaussian
	        distribution with mean 0, and variance 1.  Note that the first
	        layer is assumed to be an input layer, and by convention we
	        won't set any biases for those neurons, since biases are only
	        ever used in computing the outputs from later layers.*/
	        var self=this, i;

	        self.num_layers = sizes.length;
	        self.sizes=sizes;

	        self._nConnections = sizes.length-1;
	        for (i=0, self.biases=[], self.weights=[],
	        	self._z=[], self._y=[],
	        	self._nabla_b=[], self._nabla_w=[], self._delta_nabla_b=[], self._delta_nabla_w=[],
	        	self._sigmoidPrimeZ=[], self._delta=[], self._activationTransposed=[];
	        	i<self._nConnections; ++i){

	        	//go from input layer to output layer
	        	var sizeFrom=sizes[i];
	        	var sizeTo=sizes[i+1];
	        	self.biases.push(new WGLMatrix.MatrixRandN(sizeTo, 1));
	        	self.weights.push(new WGLMatrix.MatrixRandN(sizeTo, sizeFrom));

	        	//initialize matrices which will store intermediate computations
	        	self._z.push(new WGLMatrix.MatrixZero(sizeTo, 1)); //store Z=WX+B
	        	self._y.push(new WGLMatrix.MatrixZero(sizeTo, 1)); //store f(Z)
	        	
	        	self._nabla_b.push(new WGLMatrix.MatrixZero(sizeTo, 1));
	        	self._nabla_w.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));
	        	self._delta_nabla_b.push(new WGLMatrix.MatrixZero(sizeTo, 1));
	        	self._delta_nabla_w.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));
	        	
	        	self._delta.push(new WGLMatrix.MatrixZero(sizeTo, 1));
	       	    self._sigmoidPrimeZ.push(new WGLMatrix.MatrixZero(sizeTo, 1));
	       	    self._activationTransposed.push(new WGLMatrix.MatrixZero(1, sizeFrom));
	        }

	        var outputSize=sizes[sizes.length-1];
	        self._cost_derivative=new WGLMatrix.MatrixZero(outputSize, 1);


	        //add shader applying the sigmoid function :
	        WGLMatrix.addFunction('y=1./(ONE+exp(-x));', 'SIGMOID');
	        //add shader applying derivative of the sigmoid function
	        WGLMatrix.addFunction('vec4 a=(ONE+exp(-x)); y=exp(-x)/(a*a);', 'SIGMOIDPRIME');

	        
	        //public dynamic methods :
	        self.feedforward=function(a){
	        	//Return the output of the network if ``a`` is input.
	        	for (var i=0, inp=a; i<self._nConnections; ++i){
	        		//from input to output layer
	        		self.weights[i].fma(inp, self.biases[i], self._z[i]); //do WI+B and store result to _z

	        		//apply sigmoid to _z and store result to _y
	        		self._z[i].apply('SIGMOID', self._y[i]);

	        		//set input for the next iteration
	        		inp=self._y[i];
	        	}
	        	return inp;
	        }

			self.SGD=function(training_data, epochs, mini_batch_size, eta, test_data){
				/* Train the neural network using mini-batch stochastic
		        gradient descent.  The ``training_data`` is a list of tuples
		        ``(x, y)`` representing the training inputs and the desired
		        outputs.  The other non-optional parameters are
		        self-explanatory.  If ``test_data`` is provided then the
		        network will be evaluated against the test data after each
		        epoch, and partial progress printed out.  This is useful for
		        tracking progress, but slows things down substantially.*/
		        if (test_data) n_test = test_data.length;
		        var n=training_data.length;

		        for (var j=0; j<epochs; ++j){
		        	shuffleArray(training_data);
		        	for (var k=0, mini_batches=[]; k<n; k+=mini_batch_size){
		        		mini_batches.push(training_data.slice(k, k+mini_batch_size));
		        	}
		        	mini_batches.forEach(function(mini_batch){
		        		self.update_mini_batch(mini_batch, eta);
		        	});
		        	if (test_data){
		        		var result=self.evaluate(test_data);
		        		console.log("Epoch "+result[0].toString()+": "+result[1].toString()+" / "+n_test.toString());
		        	} else {
		        		console.log("Epoch "+j.toString()+" complete");
		        	}

		        } //end for j
			}

			self.update_mini_batch=function(mini_batch, eta){
				/*Update the network's weights and biases by applying
		        gradient descent using backpropagation to a single mini batch.
		        The ``mini_batch`` is a list of tuples ``(x, y)``, and ``eta``
		        is the learning rate.*/
		        mini_batch.forEach(function(xy){
		        	delta_nabla_bw = self.backprop(xy[0], xy[1]);

		        });

		        //self.weights

			}

			self.backprop=function(x,y){
				/*Return a tuple ``(nabla_b, nabla_w)`` representing the
		        gradient for the cost function C_x.  ``nabla_b`` and
		        ``nabla_w`` are layer-by-layer lists of numpy arrays, similar
		        to ``self.biases`` and ``self.weights``.*/

		        // feedforward
		        x.transpose(self._activationTransposed[0]); //list to store all the activations, layer by layer
		        var zs=[]; //list to store all the z vectors, layer by layer
		        for (var i=0, activation=x; i<self._nConnections; ++i){
		        	self.weights[i].fma(activation, self.biases[i], self._z[i]); //do WI+B and store result to _z
		        	zs.push(self._z[i]);
		        	self._z[i].apply('SIGMOID', self._y[i]);
		        	activation=self._y[i];
		        	activation.transpose(self._activationTransposed[i+1]);
		        }

		        // backward pass
		        var outputLayerIndex=activations.length-1;
		        var costDerivative=self.cost_derivative(activations[outputLayerIndex], y);
		        //compute sigmoid_prime(zs[-1]) :
		        zs[outputLayerIndex].apply('SIGMOIDPRIME', self._sigmoidPrimeZ[outputLayerIndex]);
				//compute output layer delta :
				var delta=costDerivative.hadamard(_sigmoidPrimeZ[outputLayerIndex], self._delta[outputLayerIndex]);
				delta.copy(self.nabla_b[outputLayerIndex]);
				delta.multiply(self._activationTransposed[outputLayerIndex-1],self.nabla_w[outputLayerIndex]);

				/*# Note that the variable l in the loop below is used a little
		        # differently to the notation in Chapter 2 of the book.  Here,
		        # l = 1 means the last layer of neurons, l = 2 is the
		        # second-last layer, and so on.  It's a renumbering of the
		        # scheme in the book, used here to take advantage of the fact
		        # that Python can use negative indices in lists.*/
		        for (var l=0; l<self.num_layers; ++l){
		        	var z=zs[zs.length-l]
		        	z.apply('SIGMOIDPRIME', self._sigmoidPrimeZ[zs.length-1]);
		        	debugger;
				
		        }


		        return [self._delta_nabla_b, self._delta_nabla_w];
			}

			self.evaluate=function(test_data){
				/*Return the number of test inputs for which the neural
		        network outputs the correct result. Note that the neural
		        network's output is assumed to be the index of whichever
		        neuron in the final layer has the highest activation.*/

			}

			self.cost_derivative=function(output_activations, y){
				/*Return the vector of partial derivatives \partial C_x /
        		\partial a for the output activations.*/
        		output_activations.sub(y, self._cost_derivative);
        		return self._cost_derivative;
			}
		} //end Network constructor
	}; //end that
	return that;
})(); //end network closure