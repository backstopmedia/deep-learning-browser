# GPU acceleration with WebGL demos (Chapter 5)


## Description

#### 0_webglFirstRendering
This our the first WebGL rendering. It draws a color gradient filling the viewport. It helps to understand basics of WebGL workflow.

#### 1_mandelBrot
We have just changed a few lines to the previous demonstration to draw a beautiful Mandelbrot fractal. It helps to apprehend the power of WebGL, where complicated pixel color computation can be done in parallel on the GPU.

#### 2_renderToTexture
We start from the first demonstration to implement a GPU computed Conway game of life. It is a simple example of how to apply render to texture. This is a discrete simulation (each pixel represents a cell which is either alive or dead).

#### 3_RTTfloat
We start from the Conway game of life demonstration, and we turn it into a continuous physical simulation of thermal diffusion. It helps to understand problems specific to floating point textures.

#### 4_WGLMatrix
We transforms the thermal simulation demonstration to a minimalist linear algebra library, called *WGLMatrix*, to compute on the GPU floating point matrices. This demonstration is only a test where some basic matrices operations are proceeded and logged to the javascript console.

#### 5_MNIST
We use a slightly improved version of *WGLMatrix* to train a shallow neural network over the MNIST dataset.

#### 6_MNISTimproved
We improve the previous example to better use the GPU, and we run it with a larger and deeper neural network.


## Hosting
You only need a local HTTP server to host these demonstrations.
These demonstration are also hosted on [jeeliz.com/book/chapter5/](https://jeeliz.com) :
* [0_webglFirstRendering](https://jeeliz.com/book/chapter5/0_webglFirstRendering/)
* [1_mandelBrot](https://jeeliz.com/book/chapter5/1_mandelBrot/)
* [2_renderToTexture](https://jeeliz.com/book/chapter5/2_renderToTexture/)
* [3_RTTfloat](https://jeeliz.com/book/chapter5/3_RTTfloat/)
* [4_WGLMatrix](https://jeeliz.com/book/chapter5/4_WGLMatrix/)
* [5_MNIST](https://jeeliz.com/book/chapter5/5_MNIST/)
* [6_MNISTimproved](https://jeeliz.com/book/chapter5/6_MNISTimproved/)


## Troubleshootings
You should run these demonstrations :
* With a desktop computer (they are not fitted for mobile devices),
* With a WebGL compatible computer. Last version of Chrome or Firefox is recommanded.

You can test your webgl compatibility [here](http://get.webgl.org). If it does not work, maybe you should update your graphic card drivers. With Chrome you can see GPU acceleration settings by entering in the URL bar: *chrome://gpu-settings*


## License

These demos are distributed under standard MIT license. See [LICENSE.txt](/LICENSE.txt) for more information.
