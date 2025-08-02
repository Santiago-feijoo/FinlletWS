const UserToRegisterModel = require("./UserToRegisterModel");
const AccessInformationModel = require("./AccessInformationModel");
const DownloadInformationModel = require("./DownloadInformationModel");
const PaymentToBeRegisteredModel = require("./PaymentToBeRegisteredModel");
const ProfileToRegisterModel = require("./ProfileToRegisterModel");

class RequestDataListModel {
    /**
    * @type {UserToRegisterModel|null}
    */
    userToRegister;

    /**
    * @type {AccessInformationModel|null}
    */
    accessInformation;

    /**
    * @type {DownloadInformationModel|null}
    */
    downloadInformation;

    /**
    * @type {string|null}
    */
    establishmentCode;

    /**
    * @type {PaymentToBeRegisteredModel|null}
    */
    paymenToBeRegistered;

    /**
    * @type {ProfileToRegisterModel|null}
    */
    profileToRegister;

}

module.exports = RequestDataListModel;