module.exports = {
    byteArrayToString: (array) => {
        let result = "";
        for (let i = 0; i < array.length; i++) {
            result += String.fromCharCode(array[i]);
        }
        return result;
    }
}
