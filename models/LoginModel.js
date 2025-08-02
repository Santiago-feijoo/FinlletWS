const DailyBalanceModel = require("./DailyBalanceModel");
const MotionModel = require("./MotionModel");
const QuotaAllocationModel = require("./QuotaAllocationModel");
const RegisteredEstablishmentInformationModel = require("./RegisteredEstablishmentInformationModel");
const RegisteredUserInformationModel = require("./RegisteredUserInformationModel");
const TransactionModel = require("./TransactionModel");
const UserProfileModel = require("./UserProfileModel");

class LoginModel {
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
    * @type {Array<UserProfileModel>|null}
    */
    listOfUserProfiles;

    /**
    * @type {Array<DailyBalanceModel>|null}
    */
    listOfDailyBalances;

    /**
    * @type {Array<QuotaAllocationModel>|null}
    */
    listOfQuotaAssignments;

    /**
    * @type {Array<TransactionModel>|null}
    */
    listOfTransactions;

    /**
    * @type {Array<MotionModel>|null}
    */
    listOfMovements;

}

module.exports = LoginModel;