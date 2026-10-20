const fetchQueue = [];
let isFetching;

const processQueue = async () => {
  if (isFetching || fetchQueue.length === 0) return;

  isFetching = true;
  const { input, resolve, reject } = fetchQueue.shift();

  try {
    const response = await window.app.kick.getChannelInfo(input);

    resolve(response);
  } catch (error) {
    console.error("Error fetching data:", error);

    resolve("error");
  } finally {
    isFetching = false;
    processQueue();
  }
};

const queueChannelFetch = (input) => {
  return new Promise((resolve, reject) => {
    fetchQueue.push({ input, resolve, reject });
    processQueue();
  });
};

export default queueChannelFetch;
