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
function main(){
	console.log('INFO in script.js : load MNIST data...');
	mnist_loader.load_data_wrapper(function(data){
		console.log('INFO in script.js : MNIST data is loaded successfully :)');

		var net = new network.Network([784, 30, 10]);
		net.SGD(data.training_data, 30, 10, 3.0, data.test_data);
		
	});
	
} //end main()
