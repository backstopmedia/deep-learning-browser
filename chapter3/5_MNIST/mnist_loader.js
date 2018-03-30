/*
Javascript equivalent of https://github.com/mnielsen/neural-networks-and-deep-learning/blob/master/src/mnist_loader.py
except we load original MNIST data instead of python wrapped MNIST data

We do not load validation data (not used for the first example)
*/

//closure
var mnist_loader=(function(){
    var _data={
        training_data: [],
        test_data: []
    };
    var _dataCounter=0;
    
    //working canvas and ctx
    var _canvas=document.createElement('canvas');
    _canvas.setAttribute('width', 784);
    _canvas.setAttribute('height', 3000);
    var _ctx=_canvas.getContext('2d');

    function load_imgData(dataSetdivideFactor, img){
        //draw the image on the canvas to be able to read pixel values
        _ctx.drawImage(img, 0,0);
        
        for (var line=0, targetData; line<3000; line++){

            //where to put the tupple [X,Y] :
            if (_dataCounter>=60000/dataSetdivideFactor){
                return false; //stop loading
            } else if (_dataCounter<50000/dataSetdivideFactor){ //first fill training data
                targetData=_data.training_data;
            } else { //then fill test data
                targetData=_data.test_data;
            }

            //compute input vector
            var iData=_ctx.getImageData(0, line, 784, 1);
            var learningInputVector=new Uint8Array(784);
            for (var i=0; i<learningInputVector.length; ++i){
                 //look only RED channel and clamp between 0 and 1 :
                learningInputVector[i]=iData.data[i*4];
            }
            
            //format output vector 
            var learningOutputVector=new Uint8Array(10);
            var expectedOutput=mnist_labels[_dataCounter];
            learningOutputVector[expectedOutput]=255;
            
            targetData.push([
                new WGLMatrix.Matrix(784, 1, learningInputVector),  //X
                new WGLMatrix.Matrix(10,  1, learningOutputVector)  //Y
                ]);
            ++_dataCounter;
        }

        return true; //continue loading
    }

    return {
        load_data_wrapper: function(dataSetdivideFactor, callback){
            /*
            Return a dictionnary with this properties :``(training_data,
            test_data)``. Based on ``load_data``, but the format is more
            convenient for use in our implementation of neural networks.

            In particular, ``training_data`` is a list containing 50,000
            2-tuples ``(x, y)``.  ``x`` is a 784-dimensional numpy.ndarray
            containing the input image.  ``y`` is a 10-dimensional
            numpy.ndarray representing the unit vector corresponding to the
            correct digit for ``x``.

            ``test_data`` is a list containing 10,000
            2-tuples ``(x, y)``.  In each case, ``x`` is a 784-dimensional
            numpy.ndarry containing the input image, and ``y`` is the
            corresponding classification, i.e., the digit values (integers)
            corresponding to ``x``.
            */

            //reset data
            _data.training_data=[];
            _data.test_data=[];
            _dataCounter=0;

            for (var i=0, images=[], nLoaded=0; i<=20; ++i){
                var img=new Image();
                img.src='data/mnist_batch_'+i.toString()+'.png';
                img.onload=function(){
                    if (++nLoaded===21){
                        //all images are loaded. decode them
                        for (var j=0; j<images.length; ++j){
                            if (!load_imgData(dataSetdivideFactor, images[j])){
                                callback(_data);
                                break;
                            };
                        };
                    }
                }
                images.push(img);
            }
        }
    }
})();
