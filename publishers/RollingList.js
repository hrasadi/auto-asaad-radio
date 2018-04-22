const AppContext = require('../AppContext');

const fs = require('fs');
const moment = require('moment');

/**
 * This class manages JSON array file, with a maximum number of entries
 */
class RollingList {
    constructor(feedName, filePrefix, maxItems = 20,
        allowDuplicateItems = true, uniqueIdentifierDelegate = null) {
        this._feedName = feedName;
        this._filePrefix = filePrefix;
        this._listFilePath = this._filePrefix + '/' + this._feedName + '.json';
        if (maxItems == 'unlimited' || maxItems <= 0) {
            this._maxItems = 0;
        } else {
            this._maxItems = maxItems;
        }

        this._uncommitedMap = {};

        this._allowDuplicateItems = allowDuplicateItems;
        if (!allowDuplicateItems) {
            if (!uniqueIdentifierDelegate) {
                throw Error('Item duplication is not allowed but ' +
                    'unique identifier delegate.');
            }
            this._getUniqueIdentifier = uniqueIdentifierDelegate;
            // From item Id to its appearance date in the archive
            this._itemExistanceMap = {};
        }
    }

    addItem(item, targetDate) {
        if (item) {
            // Duplication?
            if (!this._allowDuplicateItems) {
                let duplicationRemovalResult =
                        this.removePossibleDuplicate(item, targetDate);
                if (duplicationRemovalResult == 1) {
                    // The new item is rejected
                    return;
                }
            }

            if (!this._uncommitedMap[targetDate]) {
                this._uncommitedMap[targetDate] = [];
            }
            this._uncommitedMap[targetDate].push(item);

            // update the existance map
            this._itemExistanceMap[this._getUniqueIdentifier(item)] = targetDate;
        }
    }

    removePossibleDuplicate(item, targetDate) {
        let previousItemAppearanceDate =
            this._itemExistanceMap[this._getUniqueIdentifier(item)];
        if (previousItemAppearanceDate) {
            // Remove the newer one;
            if (moment(previousItemAppearanceDate).isBefore(moment(targetDate))) {
                AppContext.getInstance().Logger.debug(
                    `Item ${JSON.stringify(item)} got rejected. ` +
                    'An older version of this item is published already'
                );
                // Reject the new item (there is an older version)
                return 1;
            } else {
                // Remove the currently persisted version and save the new one
                this.removeItem(item, targetDate);
                AppContext.getInstance().Logger.debug(
                    `Item ${JSON.stringify(item)} overrides an already persisted version.`
                );
                return -1;
            }
        }
        return 0;
    }

    removeItem(item, fromDate) {
        // Search both history and uncommited map. It must be somewhere!
        if (this._fullHistory && this._fullHistory[fromDate]) {
            for (let i = 0; i < this._fullHistory[fromDate]; i++) {
                if (this._getUniqueIdentifier(item) ===
                    this._getUniqueIdentifier(this._fullHistory[fromDate][i])) {
                    // Remove
                    this._fullHistory[fromDate].splice(i, 1);
                    return;
                }
            }
        }
        if (this._uncommitedMap && this._uncommitedMap[fromDate]) {
            for (let i = 0; i < this._uncommitedMap[fromDate]; i++) {
                if (
                    this._getUniqueIdentifier(item) ===
                    this._getUniqueIdentifier(this._uncommitedMap[fromDate][i])) {
                    // Remove
                    this._uncommitedMap[fromDate].splice(i, 1);
                    return;
                }
            }
        }
        throw Error(`Data inconsistency detected! item ${JSON.stringify(item)}` +
             `must have exists in history but we could not locate it for removal`);
    }

    loadHistroy() {
        if (!this._fullHistory) {
            if (fs.existsSync(this._listFilePath)) {
                this._fullHistory = JSON.parse(
                    fs.readFileSync(this._listFilePath, 'utf-8')
                );
                // rebuild the existance map
                if (!this._allowDuplicateItems) {
                    this.rebuildExistanceMap();
                }
            } else {
                this._fullHistory = {};
            }
        }
    }

    rebuildExistanceMap() {
        for (let date of this._fullHistory) {
            for (let item of this._fullHistory[date]) {
                let duplicationRemovalResult = this.removePossibleDuplicate(item, date);
                if (duplicationRemovalResult == 0 || duplicationRemovalResult == -1) {
                    // 0: No duplicates. Add this item
                    // -1: the other item removed. The new one should be referenced;
                    this._itemExistanceMap[this._getUniqueIdentifier(item)] = date;
                } // Else, this item is a duplicate, nothing to add to the map
            }
        }
    }

    /**
     * Flushes list data down to disk (also applies feed capacity and timeout)
     * @param {String} pruneByDate the date for which we remove all items
     * before that (excluding)
     */
    flush(pruneByDate) {
        if (this.commit() > 0) {
            // Now sort, filter and save. Good news is that acsending string sort
            // works for us just fine
            let sortedDates = Object.keys(this._fullHistory).sort();
            if (pruneByDate) {
                sortedDates = sortedDates.filter((date) => {
                    return (date.localeCompare(pruneByDate) >= 0);
                });
            }

            let feedCapacity = this._maxItems;
            let filteredHistory = {};
            for (let date of sortedDates.reverse()) {
                // if not unlimited
                if (this._maxItems !== 0) {
                    // start from newest to oldest
                    if (feedCapacity - this._fullHistory[date].length > 0) {
                        filteredHistory[date] = this._fullHistory[date];
                        feedCapacity -= this._fullHistory[date].length;
                    } else {
                        // enough, no more room to fit another day
                        break;
                    }
                } else { // add anything in the sortedDates
                    filteredHistory[date] = this._fullHistory[date];
                }
            }
            this._fullHistory = filteredHistory;

            // Save
            fs.writeFileSync(
                this._listFilePath,
                JSON.stringify(this._fullHistory, null, 2)
            );
        }
    }

    commit() {
        let commitedDatesCount = 0;

        if (Object.keys(this._uncommitedMap).length > 0) {
            this.loadHistroy();

            for (let date in this._uncommitedMap) {
                if (this._uncommitedMap[date]) {
                    // Update the values for date with the new ones
                    this._fullHistory[date] = this._uncommitedMap[date];
                    commitedDatesCount++;
                }
            }
        }
        return commitedDatesCount;
    }

    // This is where we reassemble the items from different dates, note that
    // this function is only called once a day to update feeds, so I am not
    // worried about it doing some heavy-lifting work
    getItems(forDate) {
        // commit any uncommited changes
        this.flush();

        // We are sure that this._fullHistory is sorted based on date (older first)
        // Therefore we iterate and append values together up to the date
        let result = [];

        let includedDates = Object.keys(this._fullHistory).filter((itemDate) => {
            // Dates before or equal 'forDate'
            // lexical ordering will be used
            return (itemDate.localeCompare(forDate) <= 0);
        });

        for (let date of includedDates) {
            result = result.concat(this._fullHistory[date]);
        }

        return result;
    }
}

module.exports = RollingList;
