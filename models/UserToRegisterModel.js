const UserInformationToRegisterModel = require("./UserInformationToRegisterModel");
const EstablishmentInformationToBeRegisteredModel = require("./EstablishmentInformationToBeRegisteredModel");

class UserToRegisterModel {
    /**
    * @type {string|null}
    */
    username;

    /**
    * @type {string|null}
    */
    password;

    /**
    * @type {Number|null}
    */
    profileTypeId;

    /**
    * @type {UserInformationToRegisterModel|null}
    */
    userInformation;

    /**
    * @type {EstablishmentInformationToBeRegisteredModel|null}
    */
    establishmentInformation;

}

module.exports = UserToRegisterModel;