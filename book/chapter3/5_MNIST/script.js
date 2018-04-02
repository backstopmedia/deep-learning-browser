/*
Implements the Michael Nielsen's ebook "Neural Network and deep learning"
chapter 1 : "Using neural nets to recognize handwritten digits"
direct link : http://neuralnetworksanddeeplearning.com/chap1.html
1st example (python/MNIST data)

This is the equivalent of this code in python :

    import mnist_loader
    training_data, validation_data, test_data =mnist_loader.load_data_wrapper()
    import network
    net = network.Network([784, 30, 10])
    net.SGD(training_data, 30, 10, 3.0, test_data=test_data)
*/

//entry point
function main(dataSetdivideFactor){
    //return;
    printLog('INFO in script.js : load MNIST data...');
    setStatus('LOAD DATA...');
    mnist_loader.load_data_wrapper(dataSetdivideFactor, function(data){
        printLog('INFO in script.js : MNIST data is loaded successfully :)');
        setStatus('DATA LOADED. START TRAINING...');

        //we do not execute start immediately to allow the DOM to update
        //(for status and logging area)
        setTimeout(start.bind(null, data), 5);
    });
}

function start(data){
    var net = new network.Network([784, 30, 10]);

    var tStart=performance.now();
    net.SGD(data.training_data, 30/*epochs*/, 8/*mini_batch_size*/, 3.0/*eta*/, data.test_data,
            function(){ //callback function launched when learning is finished
                var tEnd=performance.now();
                printLog('INFO : training duration = '+((tEnd-tStart)/1000).toString()+' seconds');
            });
}

//logging
function printLog(msg){
    console.log(msg);
    document.getElementById('logArea').value+=msg+'\n';
}

//update status
function setStatus(status){
    console.log('SET STATUS = ', status);
    document.getElementById('status').value=status;
}