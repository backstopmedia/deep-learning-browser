import {KNNImageClassifier} from 'deeplearn-knn-image-classifier';
import * as dl from 'deeplearn';
import CountDownTimer from './countdown';

// Number of classes to classify
const NUM_CLASSES = 3;
// Webcam Image size. Must be 227. 
const IMAGE_SIZE = 227;
// K value for KNN
const TOPK = 10;

const Moves = Object.freeze({
  ROCK: 0,
  PAPER: 1,
  SCISSORS: 2,
});

class Main {
  constructor(){
    // Initiate variables
    this.training = -1; // -1 when no class is being trained
    this.videoPlaying = false;
    
    // Initiate deeplearn.js math and knn classifier objects
    this.knn = new KNNImageClassifier(NUM_CLASSES, TOPK);
    
    // Create video element that will contain the webcam image
    this.video = document.getElementById('cam-video');

    this.buttons = {};
    this.infoTexts = {};
    this.buttons[Moves.ROCK] = document.getElementById('train-rock-button');
    this.buttons[Moves.ROCK].addEventListener(
      'mousedown', () => this.training = Moves.ROCK);
    this.buttons[Moves.ROCK].addEventListener(
      'mouseup', () => this.training = -1);
      this.infoTexts[Moves.ROCK] = document.getElementById('train-rock-span');

    this.buttons[Moves.PAPER] = document.getElementById('train-paper-button');
    this.buttons[Moves.PAPER].addEventListener(
      'mousedown', () => this.training = Moves.PAPER);
    this.buttons[Moves.PAPER].addEventListener(
      'mouseup', () => this.training = -1);
      this.infoTexts[Moves.PAPER] = document.getElementById('train-paper-span');

    this.buttons[Moves.SCISSORS] = document.getElementById('train-scissors-button');
    this.buttons[Moves.SCISSORS].addEventListener(
      'mousedown', () => this.training = Moves.SCISSORS);
    this.buttons[Moves.SCISSORS].addEventListener(
      'mouseup', () => this.training = -1);
      this.infoTexts[Moves.SCISSORS] = document.getElementById('train-scissors-span');

    // Create button for starting a game
    this.startButton = document.getElementById('start-game-button');
    this.startButton.onclick = () => {
      this.startGame();
    }

    // Create countdown info
    this.countDownText = document.getElementById('start-game-span')
    
    // Setup webcam
    navigator.mediaDevices.getUserMedia({video: true, audio: false})
    .then((stream) => {
      this.video.srcObject = stream;
      this.video.width = IMAGE_SIZE;
      this.video.height = IMAGE_SIZE;

      this.video.addEventListener('playing', ()=> this.videoPlaying = true);
      this.video.addEventListener('paused', ()=> this.videoPlaying = false);
    })
    
    // Load knn model
    this.knn.load()
    .then(() => this.start());
  }

  startGame() {
    if (this.startButton.disabled) {
      return;
    }
    this.startButton.disabled = true;
    this.countDownTimer = new CountDownTimer(5000, 20);
    this.countDownTimer.addTickFn((msLeft) => {
      this.countDownText.innerText = " " + (msLeft/1000).toFixed(1);
      if (msLeft == 0) {
        this.startButton.disabled = false;
      }
    });
    this.countDownTimer.start();
  }
  
  start(){
    if (this.timer) {
      this.stop();
    }
    this.video.play();
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }
  
  stop(){
    this.video.pause();
    cancelAnimationFrame(this.timer);
  }
  
  animate(){
    if(this.videoPlaying){
      // Get image data from video element
      const image = dl.fromPixels(this.video);
      
      // Train class if one of the buttons is held down
      if(this.training != -1){
        // Add current image to classifier
        this.knn.addImage(image, this.training)
      }
      
      // If any examples have been added, run predict
      const exampleCount = this.knn.getClassExampleCount();
      if(Math.max(...exampleCount) > 0){
        this.knn.predictClass(image)
        .then((res)=>{
          for(let i=0;i<NUM_CLASSES; i++){
            // Make the predicted class bold
            if(res.classIndex == i){
              this.infoTexts[i].style.fontWeight = 'bold';
            } else {
              this.infoTexts[i].style.fontWeight = 'normal';
            }

            // Update info text
            if(exampleCount[i] > 0){
              this.infoTexts[i].innerText = ` ${exampleCount[i]} examples - ${res.confidences[i]*100}%`
            }
          }
        })
        // Dispose image when done
        .then(()=> image.dispose())
      } else {
        image.dispose()
      }
    }
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }
}

window.addEventListener('load', () => new Main());
