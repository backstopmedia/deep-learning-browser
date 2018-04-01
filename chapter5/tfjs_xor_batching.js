// This script is meant to be run inside a dljs Playground at https://deeplearnjs.org/demos/playground
const hiddenNumNeurons = 20;
const hidden2NumNeurons = 5;

const learningRate = 0.01;
const num_iterations = 200;
const batch_size = 20;

const weights = dl.variable(dl.randomNormal([2, hiddenNumNeurons]));
const biases = dl.variable(dl.zeros([hiddenNumNeurons]));
const weights2 = dl.variable(dl.randomNormal([hiddenNumNeurons, hidden2NumNeurons]));
const biases2 = dl.variable(dl.zeros([hidden2NumNeurons]));
const outWeights = dl.variable(dl.randomNormal([hidden2NumNeurons, 1]));
const outBias = dl.variable(dl.zeros([1]));

const optimizer = dl.train.adam(learningRate);

const epsilon = dl.scalar(1e-7);
const one = dl.scalar(1);

/*
 * Given an input, have our model output a prediction
 */
function predict(input) {
  return dl.tidy(() => {

    const hidden = input.matMul(weights).add(biases).relu();
    const hidden2 = hidden.matMul(weights2).add(biases2).relu();
    const out = hidden2.matMul(outWeights).add(outBias).sigmoid().as1D();

    return out;
  });
}

/*
 * Calculate the loss of our model's prediction vs the actual label
 */
function loss(prediction, actual) {
  // Having a good error metric is key for training a machine learning model
  return dl.tidy(() => {
    return dl.add(
      actual.mul(prediction.add(epsilon).log()),
      one.sub(actual).mul(one.sub(prediction).add(epsilon).log()))
      .mean()
      .neg().asScalar();
  });
}

/*
 * This function trains our model asynchronously
 */
async function train(numIterations, done) {
  
  for (let iter = 0; iter < numIterations; iter++) {
    
    let xs, ys, cost;
    [xs, ys] = getNRandomSamples(batch_size);
    
    cost = dl.tidy(() => {
      cost = optimizer.minimize(() => {
        const pred = predict(dl.tensor2d(xs));
        const predLoss = loss(pred, dl.tensor1d(ys));
  
        return predLoss;
      }, true);
      
      return cost;
    })
      
    if (iter % 10 == 0) {
      await cost.data().then((data) => console.log(`Iteration: ${iter} Loss: ${data}`));
    }

    await dl.nextFrame();
  }

  done();
}

/*
 * This function calculates the accuracy of our model
 */
function test(xs, ys) {
  dl.tidy(() => {
    const predictedYs = xs.map((x) => Math.round(predict(dl.tensor2d(x, [1, 2])).dataSync()));
    
    var predicted = 0;
    for (let i = 0; i < xs.length; i++) {
      if (ys[i] == predictedYs[i]) {
        predicted++;
      }
    }
    console.log(`Num correctly predicted: ${predicted} out of ${xs.length}`);
    console.log(`Accuracy: ${predicted/xs.length}`);
  })
}

/*
 * This function returns a random sample and its corresponding label
 */
function getRandomSample() {
  let x;
  x = [Math.random()*2-1, Math.random()*2-1];
  let y;
  if (x[0] > 0 && x[1] > 0 || x[0] < 0 && x[1] < 0) {
    y = 0;
  } else {
    y = 1;
  }
  return [x, y];
}

/*
 * This function returns n random samples
 */
function getNRandomSamples(n) {
  let xs = [];
  let ys = [];
  for (let iter = 0; iter < n; iter++) {
    let x, y;
    [x, y] = getRandomSample();
    xs.push(x);
    ys.push(y);
  }
  return [xs, ys];
}

let testX, testY;
[testX, testY] = getNRandomSamples(100);

// Test before training
console.log(`Before training: `);
test(testX, testY);

console.log('=============');
console.log(`Training ${num_iterations} epochs...`);

// Train, then test right after
train(num_iterations, () => {
  console.log('=============');
  console.log(
      `After training:`)
  test(testX, testY);
});
