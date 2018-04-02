/*
javascript equivalent of network.py :
https://github.com/mnielsen/neural-networks-and-deep-learning/blob/master/src/network.py

code explanation comments have been copied from network.py
and written by Michael Nielsen
*/ 

"use strict";

//closure :
var network=(function(){
    // transcode some numpy/python functions :
    //shuffle an array :
    function shuffleArray(a) {
        var j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
    }
    // get index of the max value in an array :
    function argmax(arr) {
        for (var i = 1, max = arr[0], maxIndex=0; i < arr.length; ++i) {
            if (arr[i] > max) {
                maxIndex = i;
                max = arr[i];
            }
        }
        return maxIndex;
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
            self.inputSize=sizes[0];
            self.outputSize=sizes[sizes.length-1];

            self._nConnections = sizes.length-1;
            
            for (i=0, self.biases=[], self.weights=[],
                self._weightsTransposed=[], self._weightsUpdated=[], self._biasesUpdated=[],
                self._delta_biases=[], self._delta_weights=[],
                self._z=[], self._y=[],
                self._nabla_b=[], self._nabla_w=[], self._delta_nabla_b=[], self._delta_nabla_w=[],
                self._nabla_bUpdated=[], self._nabla_wUpdated=[],
                self._actFuncPrimeZ=[], self._preDelta=[], self._delta=[];
                i<self._nConnections; ++i){

                //go from input layer to output layer
                var sizeFrom=sizes[i];
                var sizeTo=sizes[i+1];

                // allocate once and for all ALL matrices and vectors computed GPU side
                // no dynamic allocation on runtime
                self.biases.push(new WGLMatrix.MatrixRandN(sizeTo, 1));
                self.weights.push(new WGLMatrix.MatrixRandN(sizeTo, sizeFrom));
                
                self._biasesUpdated.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                self._weightsUpdated.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));
                self._weightsTransposed.push(new WGLMatrix.MatrixZero(sizeFrom, sizeTo));
                self._delta_biases.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                self._delta_weights.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));

                //initialize matrices which will store intermediate computations
                self._z.push(new WGLMatrix.MatrixZero(sizeTo, 1)); //store Z=WX+B
                self._y.push(new WGLMatrix.MatrixZero(sizeTo, 1)); //store f(Z)
                
                self._nabla_b.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                self._nabla_w.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));
                self._nabla_bUpdated.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                self._nabla_wUpdated.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));
                self._delta_nabla_b.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                self._delta_nabla_w.push(new WGLMatrix.MatrixZero(sizeTo, sizeFrom));
                
                self._delta.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                self._preDelta.push(new WGLMatrix.MatrixZero(sizeTo, 1));
                   self._actFuncPrimeZ.push(new WGLMatrix.MatrixZero(sizeTo, 1));
            }
            for (i=0, self._activationTransposed=[];
                i<self.num_layers; ++i){
                var size=sizes[i];
                self._activationTransposed.push(new WGLMatrix.MatrixZero(1, size));
            }

            self._cost_derivative=new WGLMatrix.MatrixZero(self.outputSize, 1);

            
            //add shader applying the activation function :
            WGLMatrix.addFunction('y=1./(ONE+exp(-x));', 'ACTIVATION'); //sigmoid
            
            //add shader applying derivative of the actFunc function
            //for sigmoid we have to majorate x to avoid a NaN floating point special if :
            //exp(-x)=Infinite => y=Infinite/Infinite = NaN
            WGLMatrix.addFunction('vec4 xMaj=max(x, -15.*ONE); vec4 a=(ONE+exp(-xMaj)); y=exp(-xMaj)/(a*a);', 'ACTIVATIONPRIME'); //sigmoidPrime
            
            //public dynamic methods :
            self.feedforward=function(a){
                //Return the output of the network if ``a`` is input.
                for (var i=0, inp=a; i<self._nConnections; ++i){
                    //from input to output layer
                    self.weights[i].fma(inp, self.biases[i], self._z[i]); //do WI+B and store result to _z

                    //apply actFunc to _z and store result to _y
                    self._z[i].apply('ACTIVATION', self._y[i]);

                    //set input for the next iteration
                    inp=self._y[i];
                }
                return inp;
            }

            self.SGD=function(training_data, epochs, mini_batch_size, eta, test_data, onEndCallback){
                /* Train the neural network using mini-batch stochastic
                gradient descent.  The ``training_data`` is a list of tuples
                ``(x, y)`` representing the training inputs and the desired
                outputs.  The other non-optional parameters are
                self-explanatory.  If ``test_data`` is provided then the
                network will be evaluated against the test data after each
                epoch, and partial progress printed out.  This is useful for
                tracking progress, but slows things down substantially.*/
                var n_test = test_data.length;
                var n=training_data.length;
                var j=0; //epochs counter

                //pre initilialise I/O for training RGBA multiplexing :
                var i;
                if (mini_batch_size/4!==Math.floor(mini_batch_size/4)) throw 'mini_batch_size should be a multiple of 4 for RGBA multiplexing !';
                for (i=0, self._mini_batchRGBAMultiplexed=[]; i<mini_batch_size/4; ++i){
                    self._mini_batchRGBAMultiplexed.push([
                        new WGLMatrix.MatrixZero8bits(self.inputSize, 1), //X
                        new WGLMatrix.MatrixZero8bits(self.outputSize, 1) //Y
                    ]);
                }

                //multiplex test_data :
                if (test_data.length/4!==Math.floor(test_data.length/4)) throw 'test data length should be a multiple of 4 for RGBA multiplexing !';
                var test_dataRGBAMultiplexed=[];
                for (i=0; i<test_data.length/4; ++i){
                    //initialize input and output RGBA multiplexed :
                    var inputRGBAMultiplexed=new WGLMatrix.MatrixZero8bits(self.inputSize, 1);
                    var outputRGBAMultiplexed=new WGLMatrix.MatrixZero8bits(self.outputSize, 1);

                    test_data[4*i][0].multiplexRGBA(test_data[4*i+1][0], test_data[4*i+2][0], test_data[4*i+3][0], inputRGBAMultiplexed);
                    test_data[4*i][1].multiplexRGBA(test_data[4*i+1][1], test_data[4*i+2][1], test_data[4*i+3][1], outputRGBAMultiplexed);

                    outputRGBAMultiplexed.encodedOutputValue=[
                        argmax(test_data[4*i][1].data0[0]),
                        argmax(test_data[4*i+1][1].data0[0]),
                        argmax(test_data[4*i+2][1].data0[0]),
                        argmax(test_data[4*i+3][1].data0[0])
                    ];

                    //delete previous test_data to save VRAM
                    test_data[4*i][0].remove();
                    test_data[4*i+1][0].remove();
                    test_data[4*i+2][0].remove();
                    test_data[4*i+3][0].remove();
                    test_data[4*i][1].remove();
                    test_data[4*i+1][1].remove();
                    test_data[4*i+2][1].remove();
                    test_data[4*i+3][1].remove();
                    
                    test_dataRGBAMultiplexed.push([inputRGBAMultiplexed, outputRGBAMultiplexed]);
                }
                test_data=null;
                

                var runEpoch=function(){
                    shuffleArray(training_data);
                    for (var k=0, mb, mini_batches=[]; k<n; k+=mini_batch_size){
                        mb=training_data.slice(k, k+mini_batch_size);
                        if (mb.length!==mini_batch_size) continue;
                        mini_batches.push(mb);
                    }
                    mini_batches.forEach(function(mini_batch){
                        self.update_mini_batch(mini_batch, eta);
                    });
                    //we do not execute runEpoch() immediately
                    //to let the DOM a little moment to update
                    // (for status and logging area)
                    setStatus('TESTING...');
                    setTimeout(runTest, 5);
                };

                var runTest=function(){
                    var result=self.evaluate(test_dataRGBAMultiplexed);
                    printLog("Epoch "+j+": "+result.toString()+" / "+n_test.toString());
                
                    if (++j===epochs){
                        setStatus('LEARNING FINISHED !');
                        onEndCallback();
                    } else {
                        //we do not execute runEpoch() immediately
                        //to let the DOM a little moment to update
                        // (for status and logging area)
                        setStatus('LEARNING...');
                        setTimeout(runEpoch, 5);
                    }
                }

                runEpoch();
            }

            self.update_mini_batch=function(mini_batch, eta){
                /*Update the network's weights and biases by applying
                gradient descent using backpropagation to a single mini batch.
                The ``mini_batch`` is a list of tuples ``(x, y)``, and ``eta``
                is the learning rate.*/
                for (var i=0; i<self._nConnections; ++i){
                    self._nabla_b[i].setValue(0);
                    self._nabla_w[i].setValue(0);
                }

                //multiplex over RGBA channels
                self._mini_batchRGBAMultiplexed.forEach(function(xyMultiplexed, ind){
                    var xy_r=mini_batch[4*ind],
                        xy_g=mini_batch[4*ind+1],
                        xy_b=mini_batch[4*ind+2],
                        xy_a=mini_batch[4*ind+3];
                    xy_r[0].multiplexRGBA(xy_g[0], xy_b[0], xy_a[0], xyMultiplexed[0]); //multiplex input
                    xy_r[1].multiplexRGBA(xy_g[1], xy_b[1], xy_a[1], xyMultiplexed[1]); //multiplex output
                });

                //average gradient over all minibatches :
                self._mini_batchRGBAMultiplexed.forEach(function(xy){
                    var delta_nabla_bw = self.backprop(xy[0], xy[1]);

                    for (var i=0; i<self._nConnections; ++i){
                        self._nabla_b[i].add(delta_nabla_bw[0][i], self._nabla_bUpdated[i]);
                        self._nabla_w[i].add(delta_nabla_bw[1][i], self._nabla_wUpdated[i]);
                        self._nabla_bUpdated[i].sumRGBA(self._nabla_b[i]);
                        self._nabla_wUpdated[i].sumRGBA(self._nabla_w[i]);
                    }
                });
                var learningRate=eta/mini_batch.length;
                //update bias and weights using learning rate :
                for (var i=0; i<self._nConnections; ++i){
                    self._nabla_b[i].multiplyScalar(-learningRate, self._delta_biases[i]);
                    self._nabla_w[i].multiplyScalar(-learningRate, self._delta_weights[i]);

                    self.biases[i].add(self._delta_biases[i], self._biasesUpdated[i]);
                    self.weights[i].add(self._delta_weights[i], self._weightsUpdated[i]);

                    self._biasesUpdated[i].copy(self.biases[i]);
                    self._weightsUpdated[i].copy(self.weights[i]);
                }
            }

            self.backprop=function(x,y){
                /*Return a tuple ``(nabla_b, nabla_w)`` representing the
                gradient for the cost function C_x.  ``nabla_b`` and
                ``nabla_w`` are layer-by-layer lists of numpy arrays, similar
                to ``self.biases`` and ``self.weights``.*/

                // feedforward
                x.transpose(self._activationTransposed[0]); //list to store all the activations, layer by layer
                var zs=[]; //list to store all the z vectors, layer by layer
                for (var i=0, activation=x, activations=[x]; i<self._nConnections; ++i){
                    self.weights[i].fma(activation, self.biases[i], self._z[i]); //do WI+B and store result to _z
                    zs.push(self._z[i]);
                    self._z[i].apply('ACTIVATION', self._y[i]);
                    activation=self._y[i];
                    activations.push(activation);
                    activation.transpose(self._activationTransposed[i+1]);
                }

                // backward pass
                var outputLayerIndex=self.num_layers-1;
                var costDerivative=self.cost_derivative(activations[outputLayerIndex], y);
                //compute actFunc_prime(zs[-1]) :
                zs[outputLayerIndex-1].apply('ACTIVATIONPRIME', self._actFuncPrimeZ[outputLayerIndex-1]);
                //compute output layer delta :
                var delta=costDerivative.hadamard(self._actFuncPrimeZ[outputLayerIndex-1], self._delta[outputLayerIndex-1]);
                
                delta.copy(self._delta_nabla_b[outputLayerIndex-1]);
                delta.multiply(self._activationTransposed[outputLayerIndex-1],self._delta_nabla_w[outputLayerIndex-1]);
                
                /*# Note that the variable l in the loop below is used a little
                # differently to the notation in Chapter 2 of the book.  Here,
                # l = 1 means the last layer of neurons, l = 2 is the
                # second-last layer, and so on.  It's a renumbering of the
                # scheme in the book, used here to take advantage of the fact
                # that Python can use negative indices in lists.*/
                for (var l=2; l<self.num_layers; ++l){
                    var z=zs[zs.length-l];
                    var sp=z.apply('ACTIVATIONPRIME', self._actFuncPrimeZ[zs.length-l]);
                    self.weights[self.weights.length-l+1].transpose(self._weightsTransposed[self.weights.length-l+1]);
                    delta=self._weightsTransposed[self.weights.length-l+1].multiply(delta, self._preDelta[self._delta.length-l]);
                    delta=delta.hadamard(sp, self._delta[self._delta.length-l]);
                    delta.copy(self._delta_nabla_b[self._delta_nabla_b.length-l]);
                    delta.multiply(self._activationTransposed[self._activationTransposed.length-l-1], self._delta_nabla_w[self._delta_nabla_w.length-l]);
                }

                return [self._delta_nabla_b, self._delta_nabla_w];
            }

            self.evaluate=function(test_dataRGBAMultiplexed){
                /*Return the number of test inputs for which the neural
                network outputs the correct result. Note that the neural
                network's output is assumed to be the index of whichever
                neuron in the final layer has the highest activation.*/
                var nSuccess=0;
                test_dataRGBAMultiplexed.forEach(function(xy){
                    var result=self.feedforward(xy[0]).read();
                    //take account of the 4 RGBA channels :
                    for (var i=0; i<4; ++i){ //i is the RGBA channel indice
                        var resultNumber=argmax(result[i]); //number got between 0 and 9 included
                        var expectedNumber=xy[1].encodedOutputValue[i]; //expected number
                        if (resultNumber===expectedNumber) ++nSuccess;
                    }
                });
                return nSuccess;
            }

            self.cost_derivative=function(output_activations, y){
                /*Return the vector of partial derivatives \partial C_x /
                \partial a for the output activations.*/
                return output_activations.sub(y, self._cost_derivative);
            }
        } //end Network constructor
    }; //end that
    return that;
})(); //end network closure