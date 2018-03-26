/*
Test our WebGL linear algebra lib WGLMatrix
*/

//entry point
function main(){
	var a=new WGLMatrix.Matrix(4,4,[1,2,3,4,  5,6,7,8,  9,10,11,12, 13,14,15,16]);
	var b=new WGLMatrix.Matrix(4,4,[0.2,0.6,0.7,0.8,  0.9,0.1,10,1,  1,2,3,3, -1,-10,0,0]);

	var r=new WGLMatrix.MatrixZero(4,4);

	a.add(b,r);
	//a.multiply(b, r); //do matrix operation A*B and put the result to R



} //end main()
