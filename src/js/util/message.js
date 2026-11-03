export default (...args) => {
  const obj = {};
  for (var i = 0; i < args.length; i += 2) {
    obj[args[i]] = args[i + 1];
  }
  self.postMessage(obj);
};
