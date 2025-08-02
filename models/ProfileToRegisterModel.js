const EstablishmentInformationToBeRegisteredModel = require("./EstablishmentInformationToBeRegisteredModel");

class ProfileToRegisterModel {
    /**
    * @type {Number|null}
    */
    userId;

    /**
    * @type {Number|null}
    */
    profileTypeId;

    /**
    * @type {EstablishmentInformationToBeRegisteredModel|null}
    */
    establishmentInformation;

}

module.exports = ProfileToRegisterModel;