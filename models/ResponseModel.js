const ResponseStatusModel = require("./ResponseStatusModel");
const ResponseDataListModel = require("./ResponseDataListModel");

class ResponseModel {
    /**
    * @type {string|null}
    */
    projectName = 'FinlletAPP';

    /**
    * @type {ResponseStatusModel|null}
    */
    responseStatus;

    /**
    * @type {ResponseDataListModel|null}
    */
    listOfData;

}

module.exports = ResponseModel;