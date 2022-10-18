"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const pino_1 = __importDefault(require("pino"));
class Logger {
    commonlogs;
    debuglogs;
    constructor() {
        let options = {
            formatters: {
                bindings() {
                    return {};
                },
            },
            mixin: () => {
                return {
                    _meta: {},
                };
            },
        };
        if (process.env.PRETTY_LOGS === 'yes') {
            options = {
                ...options,
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                    },
                },
            };
        }
        this.commonlogs = (0, pino_1.default)(options);
        this.debuglogs = (0, pino_1.default)({
            ...options,
            level: 'trace',
        });
    }
    isDebugEnabled() {
        return true;
    }
    getLogger() {
        if (process.env.DEBUG_LOGS === 'yes' || this.isDebugEnabled()) {
            return this.debuglogs;
        }
        return this.commonlogs;
    }
    info(msg, ...args) {
        this.getLogger().info({}, msg, ...args);
    }
    warn(msg, ...args) {
        this.getLogger().warn({}, msg, ...args);
    }
    error(msg, ...args) {
        this.getLogger().error({}, msg, ...args);
    }
    debug(msg, ...args) {
        this.getLogger().debug({}, msg, ...args);
    }
    infoj(obj) {
        this.getLogger().info(obj);
    }
    warnj(obj) {
        this.getLogger().warn(obj);
    }
    errorj(obj) {
        this.getLogger().error(obj);
    }
    debugj(obj) {
        this.getLogger().debug(obj);
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbG9nZ2VyL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGdEQUF1RDtBQXNCdkQsTUFBYSxNQUFNO0lBQ2pCLFVBQVUsQ0FBYTtJQUN2QixTQUFTLENBQWE7SUFFdEI7UUFDRSxJQUFJLE9BQU8sR0FBa0I7WUFDM0IsVUFBVSxFQUFFO2dCQUNWLFFBQVE7b0JBQ04sT0FBTyxFQUFFLENBQUM7Z0JBQ1osQ0FBQzthQUNGO1lBQ0QsS0FBSyxFQUFFLEdBQUcsRUFBRTtnQkFDVixPQUFPO29CQUNMLEtBQUssRUFBRSxFQUFFO2lCQUNWLENBQUM7WUFDSixDQUFDO1NBQ0YsQ0FBQztRQUVGLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEtBQUssS0FBSyxFQUFFO1lBQ3JDLE9BQU8sR0FBRztnQkFDUixHQUFHLE9BQU87Z0JBQ1YsU0FBUyxFQUFFO29CQUNULE1BQU0sRUFBRSxhQUFhO29CQUNyQixPQUFPLEVBQUU7d0JBQ1AsUUFBUSxFQUFFLElBQUk7cUJBQ2Y7aUJBQ0Y7YUFDRixDQUFDO1NBQ0g7UUFFRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUEsY0FBSSxFQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBQSxjQUFJLEVBQUM7WUFDcEIsR0FBRyxPQUFPO1lBQ1YsS0FBSyxFQUFFLE9BQU87U0FDZixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsY0FBYztRQUNaLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELFNBQVM7UUFDUCxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUU7WUFDN0QsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO1NBQ3ZCO1FBRUQsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxJQUFJLENBQUMsR0FBVyxFQUFFLEdBQUcsSUFBZTtRQUNsQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsSUFBSSxDQUFDLEdBQVcsRUFBRSxHQUFHLElBQWU7UUFDbEMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELEtBQUssQ0FBQyxHQUFXLEVBQUUsR0FBRyxJQUFlO1FBQ25DLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBVyxFQUFFLEdBQUcsSUFBZTtRQUNuQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQsS0FBSyxDQUFDLEdBQVc7UUFDZixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBVztRQUNmLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUVELE1BQU0sQ0FBQyxHQUFXO1FBQ2hCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELE1BQU0sQ0FBQyxHQUFXO1FBQ2hCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsQ0FBQztDQUNGO0FBaEZELHdCQWdGQztBQUVZLFFBQUEsTUFBTSxHQUFHLElBQUksTUFBTSxFQUFFLENBQUMifQ==