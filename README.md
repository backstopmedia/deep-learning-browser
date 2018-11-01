# Deep learning in the browser


<p align="center">
<img src="cover.jpg?raw=true" width="33%"/>
</p>

Official repository of the book [Deep learning in the browser](https://bleedingedgepress.com/deep-learning-browser/) released August 2018 and published by [Bleeding Edge Press](https://bleedingedgepress.com). Here you will find all of the source code of the demos in the book.

Content of this repository:
* [chapter 1: Introduction to deep learning - activation functions](/chapter1)
* [chapter 3: Deep learning frameworks for JavaScript - Tensorflow.js](/chapter3)
* [chapter 5: GPU acceleration with WebGL](/chapter5)
* [chapter 6: Extracting data from the browser](/chapter6)
* [chapter 7: Recipes for advanced data manipulation](/chapter7)
* [chapter 8: Building applications with TensorFlow.js](/chapter8)


## Getting Started

Clone the repo and all submodules.

```sh
$ git clone git@github.com:backstopmedia/deep-learning-browser.git
$ cd deep-learning-browser
$ git submodule update --init --recursive
```

You can serve the code of the chapters using a simple static webserver.

```sh
$ npm install http-server -g
$ http-server chapter6 --cors -p 8081
```

Navigate to [localhost:8081](http://localhost:8081) to run the code from the selected chapter.


## License
The whole content of this repository is released under *MIT License* (see [/LICENSE.txt](/LICENSE.txt)), except:
* Third party libraries (e.g. in `/lib` subdirectory)
* Third party data (e.g. in `/data` subdirectory)
