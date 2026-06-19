from django.test import TestCase
from django.urls import reverse

from accounts.models import CustomUser


class LoginViewTests(TestCase):
    def setUp(self):
        self.password = 'StrongPass123!'
        self.user = CustomUser.objects.create_user(
            username='sakthiuser',
            email='sakthi@example.com',
            password=self.password,
            is_setup_complete=True,
        )

    def test_login_accepts_email_address(self):
        response = self.client.post(reverse('login'), {
            'username': self.user.email,
            'password': self.password,
        })

        self.assertRedirects(response, reverse('home'))
        self.assertEqual(int(self.client.session['_auth_user_id']), self.user.id)

    def test_login_still_accepts_username(self):
        response = self.client.post(reverse('login'), {
            'username': self.user.username,
            'password': self.password,
        })

        self.assertRedirects(response, reverse('home'))
        self.assertEqual(int(self.client.session['_auth_user_id']), self.user.id)
