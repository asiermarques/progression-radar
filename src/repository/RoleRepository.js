
import roles from '../data/roles.yml';
import Role from '../domain/Role';

export class RoleRepository{

    constructor(){
        this.roles = roles.map(configRole => new Role(configRole.key, configRole.name, configRole.levels))
    }

    getRoles = () => this.roles;

    getRoleByKey = (key) => this.getRoles().reduce((selectedRole, role) => role.getKey() === key ? role : null, null)
}

export const roleRepositoryInstance = new RoleRepository();