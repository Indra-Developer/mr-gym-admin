// File: src/services/settings.ts
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface GymProfile {
  name: string;
  phone: string;
  address: string;
}

export const DEFAULT_GYM_PROFILE: GymProfile = {
  name: 'MR GYM',
  phone: '+91 76609 99890',
  address: '1st floor, AAA Complex, above Reliance Smart point, Vk Puram, Tirupati, Avilali, Andhra Pradesh 517501',
};

const gymProfileRef = doc(db, 'settings', 'gymProfile');

export const getGymProfile = async (): Promise<GymProfile> => {
  const snapshot = await getDoc(gymProfileRef);
  if (!snapshot.exists()) return DEFAULT_GYM_PROFILE;
  const data = snapshot.data();
  return {
    name: data.name || DEFAULT_GYM_PROFILE.name,
    phone: data.phone || DEFAULT_GYM_PROFILE.phone,
    address: data.address || DEFAULT_GYM_PROFILE.address,
  };
};

export const saveGymProfile = async (profile: GymProfile): Promise<void> => {
  await setDoc(gymProfileRef, {
    name: profile.name.trim(),
    phone: profile.phone.trim(),
    address: profile.address.trim(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export interface Plan {
  id: string;
  name: string;
  duration: string;
  price: number;
  category?: 'membership' | 'personalTraining';
}

const getPlansByCategory = async (category: NonNullable<Plan['category']>): Promise<Plan[]> => {
  try {
    const plansRef = collection(db, 'plans');
    const q = query(plansRef, orderBy('price', 'asc')); 
    const snapshot = await getDocs(q);

    const plans = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    })) as Plan[];

    return plans.filter(plan => {
      const savedCategory = plan.category ?? 'membership';
      return savedCategory === category;
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return [];
  }
};

export const getPlans = (): Promise<Plan[]> => getPlansByCategory('membership');

export const getPersonalTrainingPlans = (): Promise<Plan[]> => getPlansByCategory('personalTraining');

export const addPlan = async (planData: Omit<Plan, 'id'>): Promise<void> => {
  try {
    const plansRef = collection(db, 'plans');
    await addDoc(plansRef, {
      name: planData.name,
      duration: planData.duration,
      price: Number(planData.price),
      category: 'membership',
    });
  } catch (error) {
    console.error("Error adding plan:", error);
    throw error;
  }
};

export const updatePlan = async (id: string, planData: Partial<Plan>): Promise<void> => {
  try {
    const planRef = doc(db, 'plans', id);
    const payload: Partial<Plan> = { ...planData };
    if (planData.price !== undefined) payload.price = Number(planData.price);
    await updateDoc(planRef, payload);
  } catch (error) {
    console.error("Error updating plan:", error);
    throw error;
  }
};

export const addPersonalTrainingPlan = async (planData: Omit<Plan, 'id' | 'category'>): Promise<void> => {
  await addDoc(collection(db, 'plans'), {
    name: planData.name.trim(),
    duration: planData.duration.trim(),
    price: Number(planData.price),
    category: 'personalTraining',
  });
};

export const updatePersonalTrainingPlan = async (id: string, planData: Partial<Plan>): Promise<void> => {
  const payload: Partial<Plan> = { ...planData, category: 'personalTraining' };
  if (planData.price !== undefined) payload.price = Number(planData.price);
  await updateDoc(doc(db, 'plans', id), payload);
};

export const deletePersonalTrainingPlan = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'plans', id));
};

export const deletePlan = async (id: string): Promise<void> => {
  try {
    const planRef = doc(db, 'plans', id);
    await deleteDoc(planRef);
  } catch (error) {
    console.error("Error deleting plan:", error);
    throw error;
  }
};
