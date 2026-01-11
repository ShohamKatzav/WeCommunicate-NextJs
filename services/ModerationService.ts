import OpenAI from "openai";
import Account from '@/models/Account';
import ModerationViolation from '@/models/ModerationViolation';
import { Types } from 'mongoose';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Type for category scores from OpenAI
type CategoryScores = {
    harassment: number;
    'harassment/threatening': number;
    hate: number;
    'hate/threatening': number;
    illicit: number;
    'illicit/violent': number;
    'self-harm': number;
    'self-harm/instructions': number;
    'self-harm/intent': number;
    sexual: number;
    'sexual/minors': number;
    violence: number;
    'violence/graphic': number;
}

interface ModerationConfig {
    warningsBeforeBan: number;
    warningResetDays: number;
    tempBanDurationHours: number;
    permanentBanThreshold: number;
    severityThresholds: {
        high: { category: keyof CategoryScores; threshold: number }[];
        medium: { category: keyof CategoryScores; threshold: number }[];
        low: { category: keyof CategoryScores; threshold: number }[];
    };
}

const DEFAULT_CONFIG: ModerationConfig = {
    warningsBeforeBan: 3,
    warningResetDays: 30,
    tempBanDurationHours: 24,
    permanentBanThreshold: 3,
    severityThresholds: {
        high: [
            { category: 'harassment/threatening', threshold: 0.7 },
            { category: 'hate/threatening', threshold: 0.7 },
            { category: 'violence', threshold: 0.8 },
            { category: 'violence/graphic', threshold: 0.8 },
            { category: 'illicit/violent', threshold: 0.7 },
            { category: 'self-harm/intent', threshold: 0.7 },
            { category: 'sexual/minors', threshold: 0.5 }, // Very strict on this
        ],
        medium: [
            { category: 'harassment', threshold: 0.6 },
            { category: 'hate', threshold: 0.6 },
            { category: 'illicit', threshold: 0.7 },
            { category: 'sexual', threshold: 0.7 },
            { category: 'self-harm', threshold: 0.6 },
        ],
        low: [
            { category: 'self-harm/instructions', threshold: 0.5 },
        ]
    }
};

export default class ModerationService {
    private static config = DEFAULT_CONFIG;

    // Determine severity based on category scores
    private static determineSeverity(scores: CategoryScores): 'low' | 'medium' | 'high' {
        // Check high severity first
        for (const rule of this.config.severityThresholds.high) {
            if (scores[rule.category] > rule.threshold) {
                return 'high';
            }
        }

        // Check medium severity
        for (const rule of this.config.severityThresholds.medium) {
            if (scores[rule.category] > rule.threshold) {
                return 'medium';
            }
        }

        // Check low severity
        for (const rule of this.config.severityThresholds.low) {
            if (scores[rule.category] > rule.threshold) {
                return 'low';
            }
        }

        return 'low'; // Default
    }

    // Format category names for display
    private static formatCategory(category: string): string {
        return category
            .split('/')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' / ');
    }

    // Check if message violates rules
    static async moderateMessage(text: string): Promise<{
        isAllowed: boolean;
        reason?: string;
        categories?: string[];
        severity?: 'low' | 'medium' | 'high';
        scores?: CategoryScores;
    }> {
        try {
            const moderation = await openai.moderations.create({
                model: "omni-moderation-latest",
                input: text,
            });

            const result = moderation.results[0];
            const scores = result.category_scores as CategoryScores;

            // Get flagged categories with formatted names
            const flaggedCategories = Object.entries(result.categories)
                .filter(([_, flagged]) => flagged)
                .map(([category]) => this.formatCategory(category));

            // Determine severity
            const severity = result.flagged ? this.determineSeverity(scores) : undefined;

            // Create detailed reason
            let reason: string | undefined;
            if (flaggedCategories.length > 0) {
                const topCategories = Object.entries(scores)
                    .filter(([category]) => result.categories[category as keyof typeof result.categories])
                    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                    .slice(0, 3)
                    .map(([category, score]) =>
                        `${this.formatCategory(category)} (${(score * 100).toFixed(1)}%)`
                    );

                reason = `Content flagged for: ${topCategories.join(', ')}`;
            }

            return {
                isAllowed: !result.flagged,
                reason,
                categories: flaggedCategories,
                severity,
                scores
            };
        } catch (error) {
            console.error('Moderation error:', error);

            // Log the error but fail open (allow message)
            if (error instanceof OpenAI.APIError) {
                console.error('OpenAI API Error:', {
                    status: error.status,
                    message: error.message,
                    code: error.code,
                    type: error.type
                });
            }

            return { isAllowed: true };
        }
    }

    // Check if user is currently banned
    static async isUserBanned(userId: string): Promise<{
        isBanned: boolean;
        reason?: string;
        bannedUntil?: Date;
    }> {
        try {
            const user = await Account.findById(userId);

            if (!user) {
                return { isBanned: false };
            }

            // Check if temp ban has expired
            if (user.isBanned && user.bannedUntil) {
                if (new Date() > user.bannedUntil) {

                    await Account.updateOne(
                        { _id: userId },
                        {
                            $set: {
                                isBanned: false,
                                bannedUntil: null,
                                banReason: null
                            }
                        }
                    );
                    return { isBanned: false };
                }
            }

            return {
                isBanned: user.isBanned || false,
                reason: user.banReason,
                bannedUntil: user.bannedUntil
            };
        } catch (error) {
            console.error('Error checking ban status:', error);
            return { isBanned: false };
        }
    }

    // Log violation and apply punishment
    static async recordViolation(
        userId: string,
        message: string,
        reason: string,
        categories: string[],
        severity: 'low' | 'medium' | 'high'
    ): Promise<{
        action: 'warning' | 'temp_ban' | 'permanent_ban';
        warningCount: number;
        bannedUntil?: Date;
        message: string;
    }> {
        try {
            // Record the violation
            await ModerationViolation.create({
                user: new Types.ObjectId(userId),
                message,
                reason,
                severity,
                categories,
                timestamp: new Date()
            });

            const user = await Account.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Reset warnings if enough time has passed
            const daysSinceLastWarning = user.lastWarningDate
                ? (Date.now() - user.lastWarningDate.getTime()) / (1000 * 60 * 60 * 24)
                : 999;

            if (daysSinceLastWarning > this.config.warningResetDays) {
                user.warningCount = 0;
            }

            // Auto-ban for severe violations
            if (severity === 'high') {
                // Immediate permanent ban for high severity (threats, child safety, etc.)
                user.isBanned = true;
                user.banReason = reason;
                user.bannedUntil = undefined; // Permanent
                await user.save();

                return {
                    action: 'permanent_ban',
                    warningCount: user.warningCount || 0,
                    message: `You have been permanently banned. Reason: ${reason}`
                };
            }

            // Increment warning count
            user.warningCount = (user.warningCount || 0) + 1;
            user.lastWarningDate = new Date();

            // Determine punishment for medium/low severity
            if (user.warningCount >= this.config.warningsBeforeBan) {
                // Count previous temp bans
                const previousTempBans = await ModerationViolation.aggregate([
                    {
                        $match: {
                            user: new Types.ObjectId(userId),
                            severity: { $in: ['medium', 'low'] }
                        }
                    },
                    {
                        $group: {
                            _id: '$user',
                            totalViolations: { $sum: 1 }
                        }
                    }
                ]);

                const totalViolations = previousTempBans[0]?.totalViolations || 0;

                if (totalViolations >= this.config.permanentBanThreshold * 3) {
                    // Permanent ban after too many violations
                    user.isBanned = true;
                    user.banReason = 'Repeated violations of community guidelines';
                    user.bannedUntil = undefined;
                    await user.save();

                    return {
                        action: 'permanent_ban',
                        warningCount: user.warningCount,
                        message: 'You have been permanently banned for repeated violations.'
                    };
                } else {
                    // Temporary ban - escalating duration
                    const banMultiplier = Math.floor(totalViolations / this.config.warningsBeforeBan) + 1;
                    const banDuration = this.config.tempBanDurationHours * banMultiplier;
                    const bannedUntil = new Date(Date.now() + banDuration * 60 * 60 * 1000);

                    user.isBanned = true;
                    user.banReason = reason;
                    user.bannedUntil = bannedUntil;
                    user.warningCount = 0; // Reset after ban
                    await user.save();

                    return {
                        action: 'temp_ban',
                        warningCount: 0,
                        bannedUntil,
                        message: `You have been temporarily banned for ${banDuration} hours until ${bannedUntil.toLocaleString()}`
                    };
                }
            } else {
                // Just a warning
                await user.save();

                return {
                    action: 'warning',
                    warningCount: user.warningCount,
                    message: `Warning ${user.warningCount}/${this.config.warningsBeforeBan}: ${reason}`
                };
            }
        } catch (error) {
            console.error('Error recording violation:', error);
            throw error;
        }
    }

    // Get user's violation history
    static async getUserViolations(userId: string, limit: number = 10) {
        try {
            return await ModerationViolation.find({ user: userId })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error fetching violations:', error);
            return [];
        }
    }

    // Get violation stats for a user
    static async getUserViolationStats(userId: string): Promise<{
        totalViolations: number;
        bySeverity: { low: number; medium: number; high: number };
        recentViolations: number; // Last 30 days
        warningCount: number;
        isBanned: boolean;
    }> {
        try {
            const user = await Account.findById(userId);

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const [allViolations, recentViolations] = await Promise.all([
                ModerationViolation.find({ user: userId }),
                ModerationViolation.countDocuments({
                    user: userId,
                    timestamp: { $gte: thirtyDaysAgo }
                })
            ]);

            const bySeverity = {
                low: allViolations.filter(v => v.severity === 'low').length,
                medium: allViolations.filter(v => v.severity === 'medium').length,
                high: allViolations.filter(v => v.severity === 'high').length
            };

            return {
                totalViolations: allViolations.length,
                bySeverity,
                recentViolations,
                warningCount: user?.warningCount || 0,
                isBanned: user?.isBanned || false
            };
        } catch (error) {
            console.error('Error fetching violation stats:', error);
            return {
                totalViolations: 0,
                bySeverity: { low: 0, medium: 0, high: 0 },
                recentViolations: 0,
                warningCount: 0,
                isBanned: false
            };
        }
    }

    // Admin: Manually unban a user
    static async unbanUser(userId: string): Promise<boolean> {
        try {
            await Account.updateOne(
                { _id: userId },
                {
                    $set: {
                        isBanned: false,
                        bannedUntil: null,
                        banReason: null,
                        warningCount: 0
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('Error unbanning user:', error);
            return false;
        }
    }

    // Admin: Get all banned users
    static async getBannedUsers() {
        try {
            return await Account.find({ isBanned: true })
                .select('email banReason bannedUntil warningCount lastWarningDate')
                .lean();
        } catch (error) {
            console.error('Error fetching banned users:', error);
            return [];
        }
    }

    // Admin: Get moderation statistics
    static async getModerationStats() {
        try {
            const [
                totalViolations,
                totalBannedUsers,
                violationsBySeverity,
                recentViolations
            ] = await Promise.all([
                ModerationViolation.countDocuments(),
                Account.countDocuments({ isBanned: true }),
                ModerationViolation.aggregate([
                    {
                        $group: {
                            _id: '$severity',
                            count: { $sum: 1 }
                        }
                    }
                ]),
                ModerationViolation.countDocuments({
                    timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                })
            ]);

            return {
                totalViolations,
                totalBannedUsers,
                violationsBySeverity: {
                    low: violationsBySeverity.find(v => v._id === 'low')?.count || 0,
                    medium: violationsBySeverity.find(v => v._id === 'medium')?.count || 0,
                    high: violationsBySeverity.find(v => v._id === 'high')?.count || 0
                },
                recentViolations
            };
        } catch (error) {
            console.error('Error fetching moderation stats:', error);
            return null;
        }
    }
}