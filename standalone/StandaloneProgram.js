const Program = require('../entities/Program').Program;
const LivePlaybackSchedulerMeta = require('../entities/LivePlaybackSchedulerMeta');

const AppContext = require('../AppContext');

const moment = require('moment');
const execSync = require('child_process').execSync;

class StandaloneProgram extends Program {
    constructor(jsonOrOther, parent) {
        super(jsonOrOther, parent);
    }

    doScheduleProgram(targetDate, boxIdx, programIdx) {
        let lineupFilePath = AppContext.getInstance('LineupGenerator')
                                .LineupManager.getScheduledLineupFilePath(targetDate);

        this.LivePlaybackSchedulerMeta =
                                new LivePlaybackSchedulerMeta();

        let showStartTimeString = moment(this.ShowStartTime)
                                        .format('YYYYMMDDHHmm.ss');
        let showSchedulerCmd = 'echo \'cd ' + __dirname +
                                '/bin; node playback-program-show.js ' +
                                lineupFilePath + ' ' + boxIdx + ' ' +
                                programIdx + ' \' | at -t ' +
                                showStartTimeString + ' 2>&1';

        if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode ||
            AppContext.getInstance('LineupGenerator').GeneratorOptions.NoAtJob) {
            AppContext.getInstance().Logger.debug('Program show scheduler command is: ' +
                                                        showSchedulerCmd);
        } else {
            let ret = execSync(showSchedulerCmd);

            this.LivePlaybackSchedulerMeta.ShowAt = this.ShowStartTime;

            // The second token (e.g. "job xxx at Thu Jun 29 20:24:58 2017")
            this.LivePlaybackSchedulerMeta.ShowId = ret.split(' ')[1];
        }

        if (this.PreShow) {
            let preShowStartTimeString = moment(this.PreShowStartTime)
                                            .format('YYYYMMDDHHmm.ss');
            let preShowSchedulerCmd =
                                'echo \'cd ' + __dirname +
                                '/bin; node playback-program-preshow.js ' +
                                lineupFilePath +
                                this.PreShow.FillerClip ?
                                this.PreShow.FillerClip.Media.Path : '' +
                                ' ' + boxIdx + ' ' + programIdx +
                                ' \' | at -t ' +
                                preShowStartTimeString + ' 2>&1';

            if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode ||
                AppContext.getInstance('LineupGenerator').GeneratorOptions.NoAtJob) {
                AppContext.getInstance().Logger.debug('PreShow scheduler command is: ' +
                                                        preShowSchedulerCmd);
            } else {
                let ret = execSync(preShowSchedulerCmd);

                this.LivePlaybackSchedulerMeta.PreShowAt =
                                                        this.PreShowStartTime;

                // The second token (e.g. "job xxx at Thu Jun 29 20:24:58 2017")
                this.LivePlaybackSchedulerMeta.PreShowId = ret.split(' ')[1];
            }
        }
    }

    doUnscheduleProgram() {
        if (!this.LivePlaybackSchedulerMeta ||
            !this.LivePlaybackSchedulerMeta.ShowId) {
            return;
        }

        let preShowUnschedulingCmd = null;
        if (this.LivePlaybackSchedulerMeta &&
            this.LivePlaybackSchedulerMeta.ShowId) {
             preShowUnschedulingCmd = 'atrm ' +
                            this.LivePlaybackSchedulerMeta.PreShowId;
        }

        let showUnschedulingCmd = 'atrm ' +
                                    this.LivePlaybackSchedulerMeta.ShowId;

        if (AppContext.getInstance('LineupGenerator').GeneratorOptions.TestMode ||
            AppContext.getInstance('LineupGenerator').GeneratorOptions.NoAtJob) {
            if (preShowUnschedulingCmd) {
                AppContext.getInstance().Logger.debug('PreShow unscheduler command is: ' +
                                                    preShowUnschedulingCmd);
            }
            AppContext.getInstance().Logger.debug('Show unscheduler command is: ' +
                                                        showUnschedulingCmd);
        } else {
            if (preShowUnschedulingCmd) {
                let ret = execSync(preShowUnschedulingCmd);

                if (ret) {
                    AppContext.getInstance().Logger.debug(
                            'Preshow unschedule resturns non-empty: ' + ret);
                }
            }

            let ret = execSync(showUnschedulingCmd);

            if (ret) {
                AppContext.getInstance().Logger.debug(
                                'Show unschedule resturns non-empty: ' + ret);
            }
        }
    }
}

module.exports = StandaloneProgram;
