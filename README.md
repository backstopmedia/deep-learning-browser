# Deep learning in the browser


<p align="center">
<img src="cover.jpg?raw=true"/>
</p>

Official repository of the book [Deep learning in the browser](https://bleedingedgepress.com/deep-learning-browser/) released in August 2018 and published by [Bleeding Edge Press](https://bleedingedgepress.com).


## Getting Started

Clone the repo and all submodules.

```sh
$ git clone git@github.com:backstopmedia/deep-learning-browser.git
$ cd deep-learning-browser
$ git submodule update --init --recursive
```

You can serve the code of the chapters using a simple webserver.

```sh
$ npm install http-server -g
$ http-server chapter6 --cors -p 8081
```

Navigate to [localhost:8081](http://localhost:8081) to run the code from the selected chapter.
