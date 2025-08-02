class RegisteredProfileModel {
    /**
    * @type {UserProfileModel|null}
    */
    userProfile;

    /**
    * @type {RegisteredEstablishmentInformationModel|null}
    */
    establishmentInformation;

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

module.exports = RegisteredProfileModel;