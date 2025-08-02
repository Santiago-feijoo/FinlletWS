const RequestDataListModel = require("./RequestDataListModel");

class RequestModel {
    /**
    * @type {string|null}
    */
    projectName;

    /**
    * @type {RequestDataListModel|null}
    */
    listOfData;

    constructor(data) {
        this.projectName = data.projectName || null
        this.listOfData = data.listOfData || null

    }

}

module.exports = RequestModel;