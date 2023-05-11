import { User } from "../entities";
import { getDataSource } from "../orm";
import { getRememberMeToken, hash } from "../../lib/hashPassword";
import { LetterboxdAccountLevel } from "../../common/types/base";
import { isAdmin } from "../../lib/isAdmin";
import { UserPublic } from "../../common/types/db";
import { FindManyOptions, FindOptionsRelations } from "typeorm";

// const userRelations: Array<keyof FindOptionsRelations<User>> = [
//   'settings',
//   'ratings',
//   'followedLists',
//   'ownedLists',
//   'letterboxdEntrySyncs',
//   'trackedLists'
// ];

export interface UserLetterboxdDetails {
  username: string;
  name: string;
  accountLevel: LetterboxdAccountLevel
};

export interface UserCreateOptions {
  email: string;
  password: string;
  avatarUrl: string;
  letterboxd: UserLetterboxdDetails;
  rememberMe?: boolean;
}

export class UserRepoError extends Error {};
export class LoginError extends UserRepoError {};
export class RegistrationError extends UserRepoError {};

function removeCredentials(user: User) {
  const { password, salt, ...userResponse } = user;
  return userResponse;
}

function removeCredentialsAndToken(user: User) {
  const userResponse = removeCredentials(user);
  const { rememberMeToken, ...userPublic } = userResponse;
  return userPublic;
}

export const getUserRepository = async () => (await getDataSource()).getRepository(User).extend({
  // formerly checkLogin
  async login(_email: string, password: string, rememberMe?: boolean) {
    const email = _email.toLowerCase();
    const user = await this.findOne({
      where: { email }
    });

    if (user === null) {
      const message = `User ${email} not found`;
      console.log('Login Error:', message)
      throw new LoginError();
    }

    const hashed = hash(password, user.salt);
    const valid = hashed === user.password;
    if (!valid) {
      throw new LoginError('Invalid password');
    }

    if (rememberMe) {
      // create remember me token, store in db, send it back
      user.rememberMeToken = getRememberMeToken();
      await this.save(user);
    }

    return { user: removeCredentials(user) };
  },

  async clearRememberMeToken(id: number) {
    return this.update(id, { rememberMeToken: undefined });
  },
  
  // formerly checkToken
  async getUserByRememberMeToken(token: string) {
    const user = await this.findOne({
      relations: {
        settings: true
      },
      where: {
        rememberMeToken: token
      }
    });
  
    if (!user) {
      throw new UserRepoError('User not found');
    }
    
    return { user: removeCredentials(user) };
  },

  async setLastEntriesUpdated(id: number, date: Date = new Date()) {
    return await this.update({ id }, { lastEntriesUpdate: date });
  },

  async setLastEntriesUpdateAttempt(id: number, date: Date = new Date()) {
    return await this.update({ id }, { lastEntriesUpdateAttempt: date });
  },

  async getUserWithOldestEntries() {
    const users = await this.find({
      order: {
        lastEntriesUpdateAttempt: 'DESC',
        lastEntriesUpdate: 'DESC'
      },
      take: 1
    });
    if (users.length === 0) {
      return null;
    }
    return this.convertUserToPublicSafe(users[0]);
  },

  async getPublicSafeUser(userId: number) {
    const user = await this.findOne({
      where: { 
        id: userId
      },
      relations: {
        settings: true
      }
    });
    if (user === null) {
      return null;
    }
    return this.convertUserToPublicSafe(user);
  },

  async getPublicSafeUsers({ limit, offset, relations }: { limit?: number, offset?: number; relations?: FindOptionsRelations<User> } = {}) {
    const options: FindManyOptions<User> = {
      take: limit,
      skip: offset,
      relations
    };
    const users = await this.find(options);
    return users.map(this.convertUserToPublicSafe);
  },

  convertUserToPublicSafe(user: User): UserPublic {
    return ({
      ...removeCredentialsAndToken(user),
      isAdmin: isAdmin(user)
    });
  }
});