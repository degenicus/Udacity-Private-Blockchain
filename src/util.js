const handleError = (error, methodName, reject) => {
    const errorMessage = `${methodName} threw an error: ${JSON.stringify(error)}`;
    console.log(errorMessage);
    reject(errorMessage);
}

module.exports.handleError = handleError;