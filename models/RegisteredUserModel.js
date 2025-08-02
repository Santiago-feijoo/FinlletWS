const UserProfileModel = require("./UserProfileModel");
const RegisteredUserInformationModel = require("./RegisteredUserInformationModel");
const RegisteredEstablishmentInformationModel = require("./RegisteredEstablishmentInformationModel");
const DailyBalanceModel = require("./DailyBalanceModel");
const QuotaAllocationModel = require("./QuotaAllocationModel");
const MotionModel = require("./MotionModel");

class RegisteredUserModel {
    /**
    * @type {Number|null}
    */
    userId;

    /**
    * @type {string|null}
    */
    username;

    /**
    * @type {string|null}
    */
    password;

    /**
    * @type {RegisteredUserInformationModel|null}
    */
    userInformation;

    /**
    * @type {RegisteredEstablishmentInformationModel|null}
    */
    establishmentInformation;

    /**
    * @type {UserProfileModel|null}
    */
    userProfile;

    /**
    * @type {DailyBalanceModel|null}
    */
    dailyBalance;

    /**
    * @type {QuotaAllocationModel|null}
    */
    quotaAllocation;

    /**
    * @type {Array<MotionModel>|null}
    */
    listOfMovements;

}

module.exports = RegisteredUserModel;