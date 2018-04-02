function main_CPU(){
    //do the conway game of life on GPU. use SETTINGS of scriptGPU
    
    var data0=new Uint8Array(SETTINGS.simuSize*SETTINGS.simuSize);
    var data1=new Uint8Array(SETTINGS.simuSize*SETTINGS.simuSize);
    
    //randomly init cells live or dead
    for (var i=0; i<SETTINGS.simuSize*SETTINGS.simuSize; ++i){
        data0[i]=(Math.random()>0.5)?1:0;
        data1[i]=data0[i];
    }

    var datas=[data0, data1];

    function getVal(dataArr, x, y){ //reproduce the GL.CLAMP_TO_EDGE behaviour
        var xClamped=Math.min(Math.max(x, 0), SETTINGS.simuSize-1);
        var yClamped=Math.min(Math.max(y, 0), SETTINGS.simuSize-1);
        return dataArr[yClamped*SETTINGS.simuSize+xClamped];
    }

    var x, y, dataInput, dataOutput,nNeighbors;

    var tStart=performance.now();
    //simulation loop :
    for (i=0; i<SETTINGS.nIterations; ++i){
        dataInput=datas[0];
        dataOutput=datas[1];

        //debugger;
        //iterate over all cells :
        for (y=0; y<SETTINGS.simuSize; ++y){
            for (x=0; x<SETTINGS.simuSize; ++x){
                //number of living neighbors (Moore neighborhood) :
                nNeighbors= getVal(dataInput,x-1,y-1)+getVal(dataInput,x,y-1)+getVal(dataInput,x+1,y-1)
                          + getVal(dataInput,x-1,y)+getVal(dataInput,x+1,y)
                          + getVal(dataInput,x-1,y+1)+getVal(dataInput,x,y+1)+getVal(dataInput,x+1,y+1);
                if (nNeighbors===3){ //born
                    dataOutput[y*SETTINGS.simuSize+x]=1;
                } else if (nNeighbors===2){ //survive
                    dataOutput[y*SETTINGS.simuSize+x]=getVal(dataInput,x,y);
                } else { //die
                    dataOutput[y*SETTINGS.simuSize+x]=0;
                }
            }
        }
        datas.reverse();
    }
    var dt=performance.now()-tStart;
    console.log('DURATION OF THE CPU SIMULATION (in ms) : ', dt);


    //output the visualisation in a canvas2D
    var canvas=document.createElement('canvas');
    document.getElementById('content').appendChild(canvas);
    canvas.setAttribute('width', SETTINGS.simuSize);
    canvas.setAttribute('height', SETTINGS.simuSize);
    canvas.setAttribute('style', 'image-rendering: pixelated; width: 512px');
    var ctx=canvas.getContext('2d');

    var iData=ctx.createImageData(SETTINGS.simuSize, SETTINGS.simuSize);
    for (i=0; i<SETTINGS.simuSize*SETTINGS.simuSize; ++i){
        iData.data[i*4]=dataOutput[i]*255; //red
        iData.data[i*4+1]=iData.data[i*4]; //green
        iData.data[i*4+3]=255; //alpha
    }
    ctx.putImageData(iData, 0,0);

} //end main()
