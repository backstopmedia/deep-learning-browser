import numpy as np

def main(filename="data/rand.bin", size=100):
  # create an array
  r = np.random.rand(size, size)

  # write the array to disk
  with open(filename, 'wb') as f:
    f.write(r.astype(np.float32).tostring())

if __name__ == '__main__':
  main()