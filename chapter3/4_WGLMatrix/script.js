/*
Test our WebGL linear algebra lib WGLMatrix
*/

//entry point
function main(){
	var a=new WGLMatrix.Matrix(4,4,[1,2,3,4,  5,6,7,8,  9,10,11,12, 13,14,15,16]);
	var b=new WGLMatrix.Matrix(4,4,[0.2,0.6,0.7,0.8,  0.9,0.1,10,1,  1,2,3,3, -1,-10,0,0]);

	var r=new WGLMatrix.MatrixZero(4,4);

	console.log('TEST READ MATRIX : A =', a.read()[0]);
	console.log('TEST READ MATRIX : B =', b.read()[0]);

	a.add(b,r);
	console.log('TEST ADD MATRICES : A+B =', r.read()[0]);

	a.multiply(b, r); //do matrix operation A*B and put the result to R
	console.log('TEST MULTIPLY MATRICES : A*B =', r.read()[0]);

	a.multiplyScalar(0.1, r);
	console.log('TEST MULTIPLYSCALAR : A*0.1 =', r.read()[0]);

	WGLMatrix.addFunction('y=cos(x);', 'COS');
	a.apply('COS', r);
	console.log('TEST APPLY : cos(A) =', r.read()[0]);
} //end main()
