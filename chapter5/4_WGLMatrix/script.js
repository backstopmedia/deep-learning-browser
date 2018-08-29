/*
Test our WebGL linear algebra lib WGLMatrix
*/

//entry point
function main(){
    log('Please take a look at the source code of script.js');
    log('Matrix are logged flattened');
    
    //FIRST TEST SERIE
    log('\n==== FIRST TEST ====');
    var a=new WGLMatrix.Matrix(4,4,[1,2,3,4,  5,6,7,8,  9,10,11,12, 13,14,15,16]);
    var b=new WGLMatrix.Matrix(4,4,[0.2,0.6,0.7,0.8,  0.9,0.1,10,1,  1,2,3,3, -1,-10,0,0]);
    var r=new WGLMatrix.MatrixZero(4,4);

    logMatrix('TEST READ MATRIX : A =', a.read()[0]);
    logMatrix('TEST READ MATRIX 2 (GREEN CHANNEL) : A =', a.read()[1]);
    logMatrix('TEST READ MATRIX : B =', b.read()[0]);

    a.add(b,r);
    logMatrix('TEST ADD MATRICES : A+B =', r.read()[0]);

    a.multiplyScalar(0.1, r);
    logMatrix('TEST MULTIPLYSCALAR : A*0.1 =', r.read()[0]);

    WGLMatrix.addFunction('y=cos(x);', 'COS');
    a.apply('COS', r);
    logMatrix('TEST APPLY : cos(A) =', r.read()[0]);



    //SECOND TEST
    log('\n==== SECOND TEST ====');
    var m=new WGLMatrix.Matrix(3,3,[0,1,2,   3,4,5,   6,7,8]);
    var v=new WGLMatrix.Matrix(3,1,[1,2,3]);
    var w=new WGLMatrix.MatrixZero(3,1);

    logMatrix('TEST READ MATRIX : M =', m.read()[0]);
    logMatrix('TEST READ VECTOR : V =', v.read()[0]);

    m.multiply(v, w); //do matrix operation M*V and put the result to W
    logMatrix('TEST MULTIPLY MATRICES : M*V =', w.read()[0]);
    log('( expected value : [8,26,44] )');



    //THIRD TEST
    log('\n==== THIRD TEST ====');
    var a=new WGLMatrix.Matrix(2,4,[1,3,5,7, 2,4,6,8]);
    var b=new WGLMatrix.Matrix(4,3,[1,8,9,  2,7,10,  3,6,11, 4,5,12]);
    var r=new WGLMatrix.MatrixZero(2,3);

    logMatrix('TEST READ MATRIX : A =', a.read()[0]);
    logMatrix('TEST READ MATRIX : B =', b.read()[0]);

    a.multiply(b, r); //do matrix operation A*B and put the result to R
    logMatrix('TEST MULTIPLY MATRICES : A*B =', r.read()[0]);
    log('( expected value : [50,94,178,  60,120,220] )');
} //end main()

function log(msg){
    document.getElementById('logArea').value+=msg+'\n';
}

function logMatrix(msg, matrixArray){
    var m=msg+'['+matrixArray.toString()+']';
    log(m);
}