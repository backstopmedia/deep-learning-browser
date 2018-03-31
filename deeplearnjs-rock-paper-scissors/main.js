import {KNNImageClassifier} from 'deeplearn-knn-image-classifier';
import * as dl from 'deeplearn';
import CountDownTimer from './countdown';

// Number of classes to classify
const NUM_CLASSES = 3;
// Webcam Image size. Must be 227.
const IMAGE_SIZE = 227;
// K value for KNN
const TOPK = 10;

const trainButtonIds = [
  'train-rock-button',
  'train-paper-button',
  'train-scissors-button',
];

const trainSpanIds = [
  'train-rock-span',
  'train-paper-span',
  'train-scissors-span',
];

const gestureYouIds = [
  'rock-you',
  'paper-you',
  'scissors-you',
];

const gestureCpuIds = [
  'rock-cpu',
  'paper-cpu',
  'scissors-cpu',
];

const winnerMatrix = [
  [0, 1, -1],
  [-1, 0, 1],
  [1, -1, 0],
];

/**
 * Main application to start on window load
 */
class Main {
  /**
   * Constructor creates and initializes the variables needed for
   * the application
   */
  constructor() {
    // Initiate variables
    this.training = -1; // -1 when no class is being trained
    this.infoTexts = [];
    this.videoPlaying = false;
    this.currentMove = -1;
    this.firstExampleTrained = false;
    this.gaming = false;

    // Initiate deeplearn.js math and knn classifier objects
    this.knn = new KNNImageClassifier(NUM_CLASSES, TOPK);

    // Create video element that will contain the webcam image
    this.video = document.getElementById('cam-video');

    for (let i = 0; i < NUM_CLASSES; i++) {
      let button = document.getElementById(trainButtonIds[i]);
      button.addEventListener('mousedown', () => this.training = i);
      button.addEventListener('mouseup', () => this.training = -1);
      this.infoTexts.push(document.getElementById(trainSpanIds[i]));
    }

    // Create button for starting a game
    this.startButton = document.getElementById('start-game-button');
    this.startButton.onclick = () => {
      this.startGame();
    };

    this.gameStatus = document.getElementById('game-status');

    this.gestureYouImages = gestureYouIds.map((val) => {
      return document.getElementById(val);
    });

    this.gestureCpuImages = gestureCpuIds.map((val) => {
      return document.getElementById(val);
    });

    this.youImg = document.getElementById('you');
    this.hiddenCanvas = document.createElement('canvas');
    this.hiddenCanvas.width = IMAGE_SIZE;
    this.hiddenCanvas.height = IMAGE_SIZE;

    // Setup webcam
    navigator.mediaDevices.getUserMedia({video: true, audio: false})
    .then((stream) => {
      this.video.srcObject = stream;
      this.video.width = IMAGE_SIZE;
      this.video.height = IMAGE_SIZE;

      this.video.addEventListener('playing', ()=> this.videoPlaying = true);
      this.video.addEventListener('paused', ()=> this.videoPlaying = false);
    });

    // Load knn model
    this.knn.load()
    .then(() => this.start());
  }

  /**
   * Start a game of rock-paper-scissors
   */
  startGame() {
    if (this.startButton.disabled) {
      return;
    }
    this.gaming = true;
    this.startButton.disabled = true;
    this.countDownTimer = new CountDownTimer(5000, 20);
    this.countDownTimer.addTickFn((msLeft) => {
      this.gameStatus.innerText = (msLeft/1000).toFixed(1) +
      ' seconds left. Prepare your move!';
      let computerMove = Math.floor(Math.random()*3);
      for (let i = 0; i < 3; i++) {
        this.gestureCpuImages[i].hidden = (i !== computerMove);
      }
      if (msLeft == 0) {
        this.resolveGame();
      }
    });
    this.countDownTimer.start();
  }

  /**
   * Resolve the game
   */
  resolveGame() {
    this.gaming = false;
    let computerMove = Math.floor(Math.random()*3);
    let result = winnerMatrix[computerMove][this.currentMove];
    switch (result) {
      case -1:
      this.gameStatus.innerText = 'You lose. Try again!';
      break;
      case 0:
      this.gameStatus.innerText = `It's a draw! Try again.`;
      break;
      case 1:
      this.gameStatus.innerText = 'You win. Yay!';
    }
    for (let i = 0; i < 3; i++) {
      this.gestureCpuImages[i].hidden = (i !== computerMove);
      this.gestureYouImages[i].hidden = true;
    }
    this.startButton.disabled = false;
    this.hiddenCanvas.getContext('2d').drawImage(
      this.video, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    this.youImg.src = this.hiddenCanvas.toDataURL();
    this.youImg.hidden = false;
  }

  /**
   * Start the main deeplearn.js loop
   */
  start() {
    this.video.play();
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }

  /**
   * The main deeplearn.js loop
   */
  animate() {
    if (this.videoPlaying) {
      // Get image data from video element
      const image = dl.fromPixels(this.video);

      // Train class if one of the buttons is held down
      if (this.training != -1) {
        // Add current image to classifier
        this.knn.addImage(image, this.training);
      }

      // If any examples have been added, run predict
      const exampleCount = this.knn.getClassExampleCount();
      if (Math.max(...exampleCount) > 0) {
        this.knn.predictClass(image)
        .then((res)=>{
          this.currentMove = res.classIndex;
          for (let i=0; i<NUM_CLASSES; i++) {
            // Make the predicted class bold
            if (res.classIndex == i) {
              this.infoTexts[i].style.fontWeight = 'bold';
            } else {
              this.infoTexts[i].style.fontWeight = 'normal';
            }

            // Update img if in game
            if (this.gaming) {
              this.youImg.hidden = true;
              if (res.classIndex == i) {
                this.gestureYouImages[i].hidden = false;
              } else {
                this.gestureYouImages[i].hidden = true;
              }
            }

            // Update info text
            if (exampleCount[i] > 0) {
              this.infoTexts[i].innerText =
              ` ${exampleCount[i]} examples - ${res.confidences[i]*100}%`;
            }
          }
          if (!this.firstExampleTrained) {
            this.firstExampleTrained = true;
            this.startButton.disabled = false;
          }
        })
        // Dispose image when done
        .then(()=> image.dispose());
      } else {
        image.dispose();
      }
    }
    this.timer = requestAnimationFrame(this.animate.bind(this));
  }
}

window.addEventListener('load', () => new Main());
